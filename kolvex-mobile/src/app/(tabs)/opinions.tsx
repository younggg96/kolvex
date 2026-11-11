// The Web's KOL opinions: one source switcher (YouTube, Reddit, X) over each source's page.
import { useState } from "react";
import { Filters } from "../../components/Content";
import { RedditHeat } from "../../components/RedditHeat";
import { Page } from "../../components/UI";
import { XOverview } from "../../components/XOverview";
import { YouTubeOverview } from "../../components/YouTubeOverview";

export default function Opinions() {
  const [source, setSource] = useState("youtube");
  const [revision, setRevision] = useState(0);
  return (
    <Page
      title="KOL 观点"
      hideTitle
      onRefresh={() => setRevision((v) => v + 1)}
    >
      <Filters
        values={[
          ["youtube", "YouTube"],
          ["reddit", "Reddit"],
          ["x", "X"],
        ]}
        value={source}
        onChange={setSource}
      />
      {source === "youtube" ? (
        <YouTubeOverview revision={revision} />
      ) : source === "reddit" ? (
        <RedditHeat revision={revision} />
      ) : (
        <XOverview revision={revision} />
      )}
    </Page>
  );
}
