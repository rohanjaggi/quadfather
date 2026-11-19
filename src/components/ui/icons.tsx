import type { ReactNode, SVGProps } from 'react'

// The app's one icon family: 24px grid, 1.7 stroke, round caps and joins.
// Decorative by default (aria-hidden); give the parent control the label.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function Icon({ size = 22, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => <Icon {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5.5h-6V20H5a1 1 0 0 1-1-1z" /></Icon>
export const FoodIcon = (p: IconProps) => <Icon {...p}><path d="M7 3v18" /><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" /><path d="M17.5 21V3c-2 1.4-3 4-3 7.5h3" /></Icon>
export const TrainingIcon = (p: IconProps) => <Icon {...p}><path d="M7 6.5v11M17 6.5v11" /><path d="M4 9.5v5M20 9.5v5" /><path d="M7 12h10" /></Icon>
export const TrendsIcon = (p: IconProps) => <Icon {...p}><path d="M4 20h16" /><path d="M5 15.5l4.5-4.5 3 3L19 7.5" /><path d="M15 7.5h4v4" /></Icon>
export const UserIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 3.9-5.5 7-5.5s5.8 1.9 7 5.5" /></Icon>
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="M5 9l7 7 7-7" /></Icon>
export const WaterIcon = (p: IconProps) => <Icon {...p}><path d="M12 3.5c3.3 3.9 5.5 7 5.5 9.8a5.5 5.5 0 0 1-11 0c0-2.8 2.2-5.9 5.5-9.8z" /></Icon>
export const RunIcon = (p: IconProps) => <Icon {...p}><circle cx="15" cy="4.5" r="1.8" /><path d="M10 21l2.5-5.5L15 17v4" /><path d="M7 11.5l3-3 3.5 1 2 3.5H19" /><path d="M12.5 15.5 10 8.5" /></Icon>
export const CameraIcon = (p: IconProps) => <Icon {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.5" r="3.5" /></Icon>
export const TextIcon = (p: IconProps) => <Icon {...p}><path d="M5 6h14M5 10h14M5 14h9M5 18h6" /></Icon>
export const EditIcon = (p: IconProps) => <Icon {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 7.5l3 3" /></Icon>
export const BookmarkIcon = (p: IconProps) => <Icon {...p}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" /></Icon>
export const HeartIcon = (p: IconProps) => <Icon {...p}><path d="M12 19.5s-7-4.3-7-9.5A4 4 0 0 1 12 7.6 4 4 0 0 1 19 10c0 5.2-7 9.5-7 9.5z" /></Icon>
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></Icon>
export const TrophyIcon = (p: IconProps) => <Icon {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4M9 20h6" /></Icon>
export const StepsIcon = (p: IconProps) => <Icon {...p}><path d="M8.5 14c-1.6 0-2.5-1.6-2.5-4s.9-5 2.5-5 2.5 2.4 2.5 5-.9 4-2.5 4z" /><path d="M6.5 17.5c0 1.4.9 2.5 2 2.5s2-1.1 2-2.5" /><path d="M15.5 11c1.6 0 2.5-1.6 2.5-4s-.9-3-2.5-3S13 5.4 13 7.5s.9 3.5 2.5 3.5z" /><path d="M13.5 14.5c0 1.4.9 2.5 2 2.5s2-1.1 2-2.5" /></Icon>
export const TargetIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></Icon>
export const MessageIcon = (p: IconProps) => <Icon {...p}><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></Icon>
export const LinkIcon = (p: IconProps) => <Icon {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Icon>
export const KeyIcon = (p: IconProps) => <Icon {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" /></Icon>
export const CalendarIcon = (p: IconProps) => <Icon {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Icon>
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></Icon>
export const RefreshIcon = (p: IconProps) => <Icon {...p}><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></Icon>
export const SparkIcon = (p: IconProps) => <Icon {...p}><path d="M12 4l1.8 4.8L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.7z" /></Icon>
export const ListIcon = (p: IconProps) => <Icon {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".8" fill="currentColor" /><circle cx="4.5" cy="12" r=".8" fill="currentColor" /><circle cx="4.5" cy="18" r=".8" fill="currentColor" /></Icon>
export const SendIcon = (p: IconProps) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
