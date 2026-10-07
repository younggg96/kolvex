# YouTube creator profiles

The creator name in the YouTube opinions page opens a public channel profile.
The profile includes avatar/name, description, public subscriber count, public
video count, view count, channel link and the creator's imported stock opinions.

## Automatic lookup

Enable **YouTube Data API v3** in a Google Cloud project. Configure its API key as
`YOUTUBE_DATA_API_KEY` in the backend environment (Railway for production).
If this variable is absent, the backend uses `GOOGLE_API_KEY`; that key must also
have access to YouTube Data API v3. Never put the key in frontend variables.

Import the actual YouTube `channel.id` (UC followed by 22 characters), or include
`channel.handle` such as `@creator`. Channel URLs with a handle are also supported.
No channel-owner login is required for the public fields used here.

Successful lookups are cached for six hours, errors for five minutes. Opening a
profile fetches metadata; no videos are downloaded. The API is only queried for
creators present in imported opinion records. Keys are sent in a request header.

## Fallback

Without a usable key, the interface retains the imported name/avatar and optional
`channel.description`, `channel.country`, `channel.published_at`,
`channel.subscriber_count`, `channel.video_count` and `channel.view_count` fields.
Omit unknown counts rather than using zero. Set `channel.hidden_subscriber_count`
to true when subscribers are not public. Imported values are identified separately
from official YouTube data and should come from verified public information.

The profile shows unavailable/hidden counts as such. Public subscriber counts may
be rounded by YouTube. This feature does not retrieve private account information,
email addresses, phone numbers or private video statistics.

Official references:
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/channels
