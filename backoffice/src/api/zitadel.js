import { createZitadelAuth } from '@zitadel/react';

const authority = import.meta.env.VITE_ZITADEL_AUTHORITY;
const client_id = import.meta.env.VITE_ZITADEL_CLIENT_ID;

export const zitadel = (authority && client_id)
    ? createZitadelAuth({
        authority,
        client_id,
        redirect_uri: `${window.location.origin}/callback`,
        post_logout_redirect_uri: `${window.location.origin}/login`,
        scope: 'openid profile email urn:zitadel:iam:org:projects:roles',
    })
    : null;
