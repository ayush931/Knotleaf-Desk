/** Inherit the nearest workspace palette, including independent Notes themes. */
export function BrandMark({size=28,className='',label='Knotleaf Desk'}:{size?:number;className?:string;label?:string}){
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none" width={size} height={size} role={label?'img':undefined} aria-label={label||undefined} aria-hidden={label?undefined:true} className={className} data-brand-mark="true">
  <rect x="1" y="1" width="126" height="126" rx="27" fill="var(--drawing-panel)" stroke="var(--drawing-border)" strokeWidth="2"/>
  <path d="M39 83C22 46 48 22 102 24c2 43-22 69-63 59Z" fill="var(--ui-brand)"/>
  <path d="m28 103 53-54M48 82l-5-26m17 13 24 1" stroke="var(--drawing-panel)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="m28 103 17-18" stroke="var(--ui-brand)" strokeWidth="7" strokeLinecap="round"/>
 </svg>;
}
