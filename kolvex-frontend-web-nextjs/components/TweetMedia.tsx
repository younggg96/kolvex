interface TweetMediaProps {
  mediaUrls: string[];
}

export default function TweetMedia({ mediaUrls }: TweetMediaProps) {
  if (mediaUrls.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {mediaUrls.map((url, index) => {
        const isVideo = url.includes(".mp4");
        return isVideo ? (
          <video
            key={index}
            src={url}
            controls
            className="w-full rounded-lg max-h-48 object-cover"
          />
        ) : (
          <img
            key={index}
            src={url}
            alt={`Media ${index + 1}`}
            className="w-full rounded-lg max-h-48 object-cover"
          />
        );
      })}
    </div>
  );
}
