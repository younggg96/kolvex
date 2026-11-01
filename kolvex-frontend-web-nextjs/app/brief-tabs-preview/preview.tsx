"use client";
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {useTranslation} from '@/lib/i18n';
import BriefLibrary from '@/components/briefs/BriefLibrary';
export default function Preview(){const [ready,setReady]=useState(false);const {setTheme}=useTheme();const {setLocale}=useTranslation();useEffect(()=>{setTheme('dark');setLocale('zh');const original=window.fetch;window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);if(url.pathname==='/api/briefs')return Response.json({error:'No preview edition'},{status:404});return original(input,init)};setReady(true);return()=>{window.fetch=original}},[setTheme,setLocale]);return <div className="flex h-dvh flex-col bg-background text-foreground">{ready&&<BriefLibrary searchParams={{type:'morning',date:'2026-11-01'}}/>}</div>}
