fetch('https://kfjndfmbiatymgiczkhw.supabase.co/functions/v1/admin-update-user', { method: 'POST' })
    .then(res => console.log('Status:', res.status, res.statusText))
    .catch(err => console.error(err));
