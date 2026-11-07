// Simple line icons (no extra library needed).
type P = { className?: string };
const s = (className: string, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    {children}
  </svg>
);

export const CheckIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="M20 6 9 17l-5-5" />);
export const ArrowRightIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="M5 12h14M13 5l7 7-7 7" />);
export const ChevronLeftIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="m15 18-6-6 6-6" />);
export const ChevronRightIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="m9 18 6-6-6-6" />);
export const ChevronDownIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="m6 9 6 6 6-6" />);
export const ClockIcon = ({ className = "h-5 w-5" }: P) => s(className, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const CalendarIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>);
export const MonitorIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>);
export const ChatIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />);
export const VideoIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8Z" /></>);
export const PhoneIcon = ({ className = "h-5 w-5" }: P) => s(className, <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />);
export const MailIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>);
export const MapPinIcon = ({ className = "h-5 w-5" }: P) => s(className, <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>);
export const HomeIcon = ({ className = "h-5 w-5" }: P) => s(className, <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></>);
export const ChartIcon = ({ className = "h-5 w-5" }: P) => s(className, <><path d="M3 3v18h18" /><path d="M7 16v-4M12 16V8M17 16v-7" /></>);
export const PlusIcon = ({ className = "h-4 w-4" }: P) => s(className, <path d="M12 5v14M5 12h14" />);
export const TrashIcon = ({ className = "h-4 w-4" }: P) => s(className, <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>);
export const EditIcon = ({ className = "h-4 w-4" }: P) => s(className, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>);
export const UploadIcon = ({ className = "h-4 w-4" }: P) => s(className, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>);
export const SearchIcon = ({ className = "h-4 w-4" }: P) => s(className, <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const GridIcon =({ className = "h-5 w-5" }: P) => s(className, <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const LogoutIcon = ({ className = "h-5 w-5" }: P) => s(className, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
export const DotsIcon = ({ className = "h-5 w-5" }: P) => s(className, <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const DownloadIcon = ({ className = "h-4 w-4" }: P) => s(className, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>);
export const ExternalIcon = ({ className = "h-4 w-4" }: P) => s(className, <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></>);
export const MenuIcon = ({ className = "h-6 w-6" }: P) => s(className, <path d="M4 6h16M4 12h16M4 18h16" />);
export const CloseIcon = ({ className = "h-6 w-6" }: P) => s(className, <path d="M18 6 6 18M6 6l12 12" />);
export const BookIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>);
export const FileIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>);
export const ClipboardIcon = ({ className = "h-6 w-6" }: P) => s(className, <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 2h6v4H9zM9 12l2 2 4-4M9 18h6" /></>);
export const TargetIcon = ({ className = "h-6 w-6" }: P) => s(className, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const RocketIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1Z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2Z" /><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5" /></>);
export const UsersIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>);
export const UserIcon = ({ className = "h-5 w-5" }: P) => s(className, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const LockIcon = ({ className = "h-6 w-6" }: P) => s(className, <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const ShieldIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>);
export const ZapIcon = ({ className = "h-6 w-6" }: P) => s(className, <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />);
export const ReceiptIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>);
export const GraduationIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></>);
export const AwardIcon = ({ className = "h-6 w-6" }: P) => s(className, <><circle cx="12" cy="8" r="6" /><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1" /></>);
export const HeadsetIcon = ({ className = "h-6 w-6" }: P) => s(className, <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2ZM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2Z" /><path d="M18 17v1a3 3 0 0 1-3 3h-3" /></>);
export const InstagramIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" /></>);
export const YouTubeIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" /></>);
export const GoogleIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 48 48" aria-hidden className={className}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
export const StarIcon =({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z" /></svg>
);
export const WhatsAppIcon = ({ className = "h-6 w-6" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4ZM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.3-1.7A11.8 11.8 0 0 0 24 12c0-3.2-1.2-6.2-3.6-8.4Z" /></svg>
);
export const TagIcon = ({ className = "h-5 w-5" }: P) => s(className, <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></>);
export const GiftIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v9H5v-9" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>);
export const CopyIcon = ({ className = "h-5 w-5" }: P) => s(className, <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>);
export const MegaphoneIcon = ({ className = "h-5 w-5" }: P) => s(className, <><path d="m3 11 15-6v14L3 13v-2Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>);
export const ArrowUpIcon = ({ className = "h-4 w-4" }: P) => s(className, <path d="M12 19V5M5 12l7-7 7 7" />);
export const ArrowDownIcon = ({ className = "h-4 w-4" }: P) => s(className, <path d="M12 5v14M19 12l-7 7-7-7" />);
