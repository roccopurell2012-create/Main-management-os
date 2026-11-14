'use client';
import { useState, useTransition } from 'react';
export default function ActionForm({ action, children, ...props }) {
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [pending, startTransition] = useTransition();
    function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError('');
        setStatus('');
        startTransition(async () => {
            try {
                await action(data);
                form.reset();
                setStatus('Your request was saved.');
            }
            catch (error) {
                if (typeof error?.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT;')) throw error;
                setError('The request could not be completed. Check the required fields, password length, file type and size, or wait a minute before retrying. Your entries have been kept.');
            }
        });
    }
    return <form {...props} action={action} onSubmit={submit} aria-busy={pending}>
    {status && <p className="wide" role="status">{status}</p>}
    {error && <p className="notice wide" role="alert">{error}</p>}
    <fieldset className="action-fields" disabled={pending}>{children}</fieldset>
    <span className="sr-only" role="status">{pending ? 'Saving your request…' : ''}</span>
  </form>;
}
