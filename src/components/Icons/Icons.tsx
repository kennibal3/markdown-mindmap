type IconProps = {
  className?: string
}

function IconFrame({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? 'button-icon'}
      fill="none"
      viewBox="0 0 20 20"
    >
      {children}
    </svg>
  )
}

export function BrandMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" fill="none" viewBox="0 0 46 46">
      <path d="M13 11.5h20v23H13z" />
      <path d="M18 17h10M18 22.5h10M18 28h6" />
      <path d="M30 31c2.2-1.6 3.8-4.2 4.1-7.2" />
      <circle cx="34.2" cy="20.8" r="2.3" />
    </svg>
  )
}

export function FileIcon() {
  return (
    <IconFrame>
      <path d="M5 2.75h6l4 4v10.5H5z" />
      <path d="M11 2.75v4h4M7.5 11h5M7.5 14h3.5" />
    </IconFrame>
  )
}

export function SparkIcon() {
  return (
    <IconFrame>
      <path d="M10 2.5c.5 3.7 2.1 5.5 5.5 6-3.4.5-5 2.3-5.5 6-.5-3.7-2.1-5.5-5.5-6 3.4-.5 5-2.3 5.5-6Z" />
      <path d="M15.5 13.5c.2 1.5.9 2.2 2 2.5-1.1.3-1.8 1-2 2.5-.2-1.5-.9-2.2-2-2.5 1.1-.3 1.8-1 2-2.5Z" />
    </IconFrame>
  )
}

export function DownloadIcon() {
  return (
    <IconFrame>
      <path d="M10 2.5v10M6.5 9l3.5 3.5L13.5 9M4 16.5h12" />
    </IconFrame>
  )
}
