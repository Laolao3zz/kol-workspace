import { normalizeProfileUrl } from './profileUrl'

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`，。；：！？、]+|(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|xiaohongshu\.com|weibo\.com)\/[^\s<>"'`，。；：！？、]+/gi
const TRAILING_PUNCTUATION = /[\])}>.,;:!?，。；：！？、」』】》）]+$/

function cleanExtractedUrl(value: string): string {
  return value
    .replace(/^[(\[{<]+/, '')
    .replace(TRAILING_PUNCTUATION, '')
    .trim()
}

export function extractKolIntakeUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) || []
  const seen = new Set<string>()

  return matches.reduce<string[]>((urls, match) => {
    const cleaned = cleanExtractedUrl(match)
    if (!cleaned) return urls

    const identity = normalizeProfileUrl(cleaned)
    if (!identity || seen.has(identity)) return urls

    seen.add(identity)
    urls.push(cleaned)
    return urls
  }, [])
}
