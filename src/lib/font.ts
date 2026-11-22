import localFont from 'next/font/local'

/** Единый шрифт всего интерфейса. */
export const subkultur = localFont({
  src: '../fonts/Subkultur-Regular-Trial.ttf',
  variable: '--font-subkultur',
  display: 'swap',
  weight: '400',
  style: 'normal',
  preload: true,
})
