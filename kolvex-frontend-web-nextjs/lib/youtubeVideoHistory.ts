import { opinionDay } from "./opinionDates";
import type { YouTubeOpinion, YouTubeUntrackedUpload } from "./youtubeOpinionsApi";

export type VideoOpinionGroup = {
  videoId: string;
  video: Pick<YouTubeOpinion, "video_id" | "video_title" | "video_url" | "thumbnail_url" | "video_published_at"> & { opinion_date?: string };
  opinions: YouTubeOpinion[];
};

export function groupOpinionsByVideo(opinions: YouTubeOpinion[]) {
  const groups = new Map<string, VideoOpinionGroup>();
  for (const opinion of opinions) {
    const key = opinion.video_id || opinion.id;
    const group = groups.get(key);
    if (group) group.opinions.push(opinion);
    else groups.set(key, { videoId: key, video: opinion, opinions: [opinion] });
  }
  return Array.from(groups.values());
}

export function videoHistory(
  opinions: YouTubeOpinion[],
  uploads: YouTubeUntrackedUpload[],
  from = "",
  to = "",
) {
  const groups = groupOpinionsByVideo(opinions);
  const known = new Set(groups.map((group) => group.videoId));
  for (const upload of uploads) {
    if (!upload.video_id || known.has(upload.video_id)) continue;
    const day = opinionDay(upload.published_at);
    if ((from && (!day || day < from)) || (to && (!day || day > to))) continue;
    known.add(upload.video_id);
    groups.push({
      videoId: upload.video_id,
      video: {
        video_id: upload.video_id,
        video_title: upload.title,
        video_url: `https://www.youtube.com/watch?v=${encodeURIComponent(upload.video_id)}`,
        video_published_at: upload.published_at,
      },
      opinions: [],
    });
  }
  const timestamp = (group: VideoOpinionGroup) => {
    const value = group.video.video_published_at || group.video.opinion_date;
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return groups.sort((a, b) => timestamp(b) - timestamp(a));
}
