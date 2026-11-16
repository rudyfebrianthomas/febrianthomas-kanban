export const SUPPORT_BUTTON_IDS = ['streamlabs', 'saweria', 'kofi', 'trakteer'] as const
export type SupportButtonId = (typeof SUPPORT_BUTTON_IDS)[number]

export const FOOTER_STARTERS = ['bulba', 'ivy', 'venu'] as const

export const BACKGROUND_SHAPE_PATHS = [
  ['translate3d(-55px, -60px, 0)', 'translate3d(130px, 65px, 0)', 'translate3d(-60px, 160px, 0)'],
  ['translate3d(75px, -60px, 0)', 'translate3d(-120px, 30px, 0)', 'translate3d(35px, 140px, 0)'],
  ['translate3d(-80px, 75px, 0)', 'translate3d(50px, -90px, 0)', 'translate3d(140px, 65px, 0)'],
]
