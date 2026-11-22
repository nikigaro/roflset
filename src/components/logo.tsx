import Image from 'next/image'
import Link from 'next/link'

/** Только значок. Клик всегда переносит на стену. */
export default function Logo() {
  return (
    <Link href="/chat" className="inline-flex items-center transition-transform duration-150 hover:-translate-y-0.5" aria-label="РофлСеть — стена">
      <Image
        src="/logo-rofset.png"
        alt="РофлСеть"
        width={40}
        height={40}
        priority
        className="block shrink-0 dark:invert"
      />
    </Link>
  )
}
