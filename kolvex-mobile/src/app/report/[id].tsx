import { useLocalSearchParams } from "expo-router";
import { ArticleSkeleton } from "../../components/Skeletons";
import { useAuth } from "../../state/Auth";
import { report } from "../../lib/contentApi";
import { useResource } from "../../lib/useResource";
import { Page } from "../../components/UI";
import { ResourceState } from "../../components/Content";
import { ReportBody } from "../../components/ReportBody";
export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth().session?.user.id;
  const r = useResource(`report:${user}:${id}`, (signal) =>
    report(id, user ?? "", signal),
  );
  return (
    <Page
      title={r.data?.ticker || "研究报告"}
      subtitle={r.data?.trade_date}
      onRefresh={r.refresh}
      refreshing={r.loading}
    >
      <ResourceState
        skeleton={<ArticleSkeleton />}
        resource={r}
        empty={!r.data}
        message="报告未公开、已删除或暂不可用。"
      />
      {r.data && <ReportBody item={r.data} />}
    </Page>
  );
}
