#!/bin/sh
# Publish the demo: one tunnel route for the door's public listener, then the static page on ce-net.com.
#   sh deploy/publish.sh <tunnel name or id> [hostname]      (default hostname inference-wire.ce-net.com)
# Needs CLOUDFLARE_API_TOKEN (tunnel + DNS edit) and CLOUDFLARE_ACCOUNT_ID, and the ce-net.com site checkout next to
# this repo (../ce-net.com). It adds one ingress rule (hostname -> http://127.0.0.1:7797) before the catch-all and
# a proxied CNAME; every other rule is kept as it is.
set -eu
T=${1:?usage: publish.sh <tunnel name or id> [hostname]}
H=${2:-inference-wire.ce-net.com}
: "${CLOUDFLARE_API_TOKEN:?}" "${CLOUDFLARE_ACCOUNT_ID:?}"
api() { curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' "$@"; }
B=https://api.cloudflare.com/client/v4
ID=$(api "$B/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel?is_deleted=false" | python3 -c "import json,sys;t=sys.argv[1];print(next(x['id'] for x in json.load(sys.stdin)['result'] if t in (x['id'],x['name'])))" "$T")
api "$B/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$ID/configurations" | python3 -c "
import json,sys
h=sys.argv[1]; c=json.load(sys.stdin)['result']['config']
ing=[r for r in c.get('ingress',[]) if r.get('hostname')!=h]
ing.insert(len(ing)-1 if ing and 'hostname' not in ing[-1] else len(ing), {'hostname':h,'service':'http://127.0.0.1:7797'})
c['ingress']=ing; print(json.dumps({'config':c}))" "$H" > /tmp/ingress.json
api -X PUT "$B/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$ID/configurations" --data @/tmp/ingress.json >/dev/null
Z=$(api "$B/zones?name=ce-net.com" | python3 -c "import json,sys;print(json.load(sys.stdin)['result'][0]['id'])")
api -X POST "$B/zones/$Z/dns_records" --data "{\"type\":\"CNAME\",\"name\":\"$H\",\"content\":\"$ID.cfargotunnel.com\",\"proxied\":true}" >/dev/null || echo "dns: $H exists already"
printf '{"wire":"wss://%s/wire","grant":"https://%s/grant"}\n' "$H" "$H" > ../ce-net.com/demos/inference/config.json
echo "route: https://$H/grant?page=inference should answer JSON now"
cd ../ce-net.com && sh bin/deploy-cloudflare.sh
