'use client';
import { useFormStatus } from 'react-dom';
export default function Submit({ children, className }) { const { pending } = useFormStatus(); return <button className={className} disabled={pending} aria-disabled={pending}>{pending ? 'Saving…' : children}</button>; }
