export const Ic = {
  Check: ({s=12})=>(
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Plus: ({s=13,c="#10b981"})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 2V12M2 7H12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Trash: ({s=12})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M2 4H12M5 4V3H9V4M3 4L4 12H10L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Cal: ({s=12,c="currentColor"})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke={c} strokeWidth="1.3"/>
      <path d="M5 1V4M9 1V4M1.5 6H12.5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Lock: ({s=13,open=false})=>open?(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 6V4.5A2.5 2.5 0 0 1 7 2C7.9 2 8.7 2.4 9.2 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
    </svg>
  ):(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 6V4.5A2.5 2.5 0 0 1 9.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
    </svg>
  ),
  Brain: ({s=14,c="currentColor"})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 2C6 2 4 3.5 4 5.5C4 7 5 8 4 9.5C3 11 2 12 3.5 13C5 14 6 13 8 13C10 13 11 14 12.5 13C14 12 13 11 12 9.5C11 8 12 7 12 5.5C12 3.5 10 2 8 2Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M8 5V8M6 6.5H10" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Pencil: ({s=12,c="currentColor"})=>(
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M8 2L10 4L4 10H2V8L8 2Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  Eye: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  Share: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <circle cx="11" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="3" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="11" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.7 6.2L9.3 4.1M4.7 7.8L9.3 9.9" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  ChevL: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ChevR: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  User: ({s=15})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 14C2 11.2 4.7 9 8 9C11.3 9 14 11.2 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Logout: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M9 7H2M7 4L10 7L7 10M5 2H11C11.6 2 12 2.4 12 3V11C12 11.6 11.6 12 11 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Warn: ({s=13,c="#f59e0b"})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1L13 12H1L7 1Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M7 5V8M7 10V10.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  PriNone: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="#a7f3d0" strokeWidth="1.5"/>
    </svg>
  ),
  PriLow: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 10L8 13L12 10" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6L8 9L12 6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
    </svg>
  ),
  PriMed: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="5.5" width="10" height="2" rx="1" fill="#f59e0b"/>
      <rect x="3" y="9" width="10" height="2" rx="1" fill="#f59e0b" opacity="0.45"/>
    </svg>
  ),
  PriHigh: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 3L13 11H3L8 3Z" fill="#ef4444"/>
    </svg>
  ),
  Org: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="5" y="1.5" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="9.5" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="9.5" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 4.5V7M3 7H11M3 7V9.5M11 7V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Fit: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M1 5V2H4M10 2H13V5M13 9V12H10M4 12H1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Export: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1V9M4 6L7 9L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Import: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 9V1M4 6L7 3L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Moon: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M14 10A7 7 0 0 1 6 2a6 6 0 1 0 8 8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  Sun: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3.2 3.2L4.6 4.6M11.4 11.4L12.8 12.8M3.2 12.8L4.6 11.4M11.4 4.6L12.8 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};

export function PriIcon({ p, s=14 }) {
  if (p==="high")   return <Ic.PriHigh s={s}/>;
  if (p==="medium") return <Ic.PriMed  s={s}/>;
  if (p==="low")    return <Ic.PriLow  s={s}/>;
  return <Ic.PriNone s={s}/>;
}
