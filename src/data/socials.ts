import { siInstagram, siThreads, siTiktok, siTwitch, siX, siYoutube, type SimpleIcon } from 'simple-icons'

export type SocialKey = 'instagram' | 'threads' | 'twitter' | 'tiktok' | 'youtube' | 'twitch'

export interface SocialLink {
  key: SocialKey
  name: string
  url: string
  icon: SimpleIcon
  colorClass: string
}

export const socials: SocialLink[] = [
  {
    key: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com/febrianthomas_',
    icon: siInstagram,
    colorClass: 'bg-pink-100 text-pink-700 dark:bg-pink-200 dark:text-pink-800',
  },
  {
    key: 'threads',
    name: 'Threads',
    url: 'https://www.threads.com/@febrianthomas_',
    icon: siThreads,
    colorClass: 'bg-zinc-200 text-zinc-950 dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    key: 'twitter',
    name: 'X / Twitter',
    url: 'https://x.com/febrianthomas_',
    icon: siX,
    colorClass: 'bg-zinc-200 text-zinc-950 dark:bg-zinc-100 dark:text-zinc-950',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    url: 'https://www.tiktok.com/@febrianthomas_',
    icon: siTiktok,
    colorClass: 'bg-cyan-100 text-zinc-950 dark:bg-cyan-200 dark:text-zinc-950',
  },
  {
    key: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/@febrianthomas',
    icon: siYoutube,
    colorClass: 'bg-red-100 text-red-700 dark:bg-red-200 dark:text-red-800',
  },
  {
    key: 'twitch',
    name: 'Twitch',
    url: 'https://www.twitch.tv/febrianthomas/about',
    icon: siTwitch,
    colorClass: 'bg-violet-100 text-violet-700 dark:bg-violet-200 dark:text-violet-800',
  },
]
