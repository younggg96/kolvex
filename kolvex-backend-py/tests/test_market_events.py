import json
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.services.market_events import Envelope, window, list_events, save_events
from app.api.routes.market_events import router
from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
ROOT = Path(__file__).resolve().parents[2]
def sample():
    return json.loads((ROOT / 'docs/examples/market-events.json').read_text())

class SchemaTests(unittest.TestCase):
    def test_example_and_schema(self):
        self.assertEqual(Envelope.model_validate(sample()).model_dump(mode='json'), sample())
        self.assertEqual(Envelope.model_json_schema(), json.loads((ROOT/'docs/market-events.schema.json').read_text()))

    def test_invalid_and_duplicate_events(self):
        for patch in [{'event_date':'2026-02-30'}, {'category':'unknown'}, {'timing':'scheduled'}, {'source_url':'javascript:alert(1)'}, {'source_url':'https://user:pass@example.com'}, {'is_hot':'false'}, {'importance':'critical'}, {'id':'bad id'}, {'title':'  '}]:
            doc=sample();doc['events'][0].update(patch)
            with self.subTest(patch=patch), self.assertRaises(ValidationError): Envelope.model_validate(doc)
        doc=sample();doc['events'] *= 2
        with self.assertRaises(ValidationError): Envelope.model_validate(doc)

    def test_time_zone_dates_and_dst(self):
        for date, stamp in [('2026-10-28','2026-10-28T14:00:00-04:00'), ('2026-11-02','2026-11-02T14:00:00-05:00')]:
            doc=sample();doc['events'][0].update(event_date=date,starts_at=stamp,timing='scheduled')
            self.assertEqual(Envelope.model_validate(doc).events[0].event_date.isoformat(),date)
        for stamp in ['2026-10-28T14:00:00','2026-10-28T01:00:00Z']:
            doc=sample();doc['events'][0].update(starts_at=stamp,timing='scheduled')
            with self.assertRaises(ValidationError): Envelope.model_validate(doc)

    def test_week_year_and_dst_boundaries(self):
        for now,start,end in [('2026-10-26T03:59:00+00:00','2026-10-12','2026-11-02'),('2026-10-26T04:00:00+00:00','2026-10-19','2026-11-09'),('2026-11-02T05:00:00+00:00','2026-10-26','2026-11-16'),('2027-01-01T12:00:00+00:00','2026-12-21','2027-01-11')]:
            actual=window(datetime.fromisoformat(now))
            self.assertEqual((actual[0].isoformat(),actual[1].isoformat()),(start,end))

class ServiceTests(unittest.TestCase):
    def test_read_filters_and_pagination(self):
        db=Mock();q=db.table.return_value
        for method in ['select','eq','gte','lt','or_','order','range']: getattr(q,method).return_value=q
        event=sample()['events'][0]
        q.execute.side_effect=[Mock(data=[{'payload':event}],count=2),Mock(data=[{'payload':{**event,'id':'second'}}])]
        result=list_events(db, now=datetime.fromisoformat('2026-10-28T12:00:00+00:00'))
        self.assertEqual(len(result['events']),2)
        q.eq.assert_called_once_with('status','published')
        q.gte.assert_called_once_with('event_date','2026-10-19')
        q.lt.assert_called_once_with('event_date','2026-11-09')
        q.or_.assert_called_once_with('importance.eq.high,is_hot.eq.true')

    def test_atomic_idempotent_upsert(self):
        db=Mock();doc=Envelope.model_validate(sample()).model_dump(mode='json')
        self.assertEqual(save_events(db,doc,'admin'),{'saved':1})
        rows=db.table.return_value.upsert.call_args.args[0]
        self.assertEqual(rows[0]['payload'],doc['events'][0])
        self.assertEqual(rows[0]['updated_by'],'admin')
        self.assertEqual(db.table.return_value.upsert.call_args.kwargs,{'on_conflict':'id'})

class RouteTests(unittest.TestCase):
    def setUp(self):
        self.db=Mock();self.app=FastAPI();self.app.include_router(router)
        self.app.dependency_overrides[get_supabase_service]=lambda:self.db
        self.client=TestClient(self.app)

    def test_auth_required(self):
        for path in ['/market/events','/admin/market-events']:
            self.assertIn(self.client.get(path).status_code,[401,403])
        self.assertIn(self.client.post('/admin/market-events',json=sample()).status_code,[401,403])

    def test_non_admin_cannot_write_or_validate(self):
        self.app.dependency_overrides[get_current_user_id]=lambda:'reader'
        self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value=Mock(data={'is_admin':False})
        for path in ['/admin/market-events','/admin/market-events/validate']:
            self.assertEqual(self.client.post(path,json=sample()).status_code,403)
        self.assertEqual(self.client.get('/admin/market-events').status_code,403)
        self.db.table.return_value.upsert.assert_not_called()

    def test_admin_validate_save_and_errors(self):
        self.app.dependency_overrides[get_current_user_id]=lambda:'admin'
        self.db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value=Mock(data={'is_admin':True})
        self.assertEqual(self.client.post('/admin/market-events/validate',json=sample()).status_code,200)
        self.db.table.return_value.upsert.assert_not_called()
        self.assertEqual(self.client.post('/admin/market-events',json=sample()).json(),{'saved':1})
        self.assertEqual(self.client.post('/admin/market-events/validate',content='{').status_code,422)
        self.assertEqual(self.client.post('/admin/market-events',content='x'*(1024*1024+1)).status_code,413)
        self.db.table.return_value.upsert.return_value.execute.side_effect=RuntimeError('db unavailable')
        self.assertEqual(self.client.post('/admin/market-events',json=sample()).status_code,503)

if __name__ == '__main__': unittest.main()
