# plex-cert-gen
Generate plex.direct SSL certificates for local reverse proxy purposes

bind a folder to the container @ /config for cert & key output (privkey.pem, fullchain.pem)

pass env vars to container
PLEX_SERVER_ID: plex server id
PLEX_SERVER_TOKEN: plex server token (find in Preferences.xml or devices.xml in web inspector on app.plex.tv)
