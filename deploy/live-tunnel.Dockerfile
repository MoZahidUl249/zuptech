# The SSH tunnel to the live database, as a container.
#
# A container rather than a background ssh process on the host because the
# whole local loop is docker-managed: `docker ps` shows the tunnel next to the
# stack it feeds, and `docker rm -f` is the only thing needed to be certain it
# is gone. A stray backgrounded ssh is invisible in exactly the situation where
# you most want to know whether a laptop still holds a socket open to the
# production database.
#
# Built by scripts/live-tunnel.sh; deliberately NOT a service in
# docker-compose.yml, so nothing that deploys can ever start it.
#
# The host's ~/.ssh is bind-mounted read-only at /root/.ssh, so this uses the
# same key and the same known_hosts as a normal `ssh` from the workstation.
# Host-key checking is therefore left at its strict default: if the VPS is not
# already a known host, the tunnel fails loudly and the script says to ssh in
# by hand once. Trusting an unverified host key to reach a production database
# is not a convenience worth having.
FROM alpine:3.20

RUN apk add --no-cache openssh-client

# ExitOnForwardFailure is the important flag. Without it ssh connects happily
# when the local bind fails, so the tunnel reports "up" while nothing is
# listening — and the failure surfaces later as an unrelated-looking connection
# error from Prisma. ServerAliveInterval stops an idle NAT timeout from
# silently dropping the forward mid-session.
ENTRYPOINT ["ssh", "-N", \
  "-o", "ExitOnForwardFailure=yes", \
  "-o", "ServerAliveInterval=30", \
  "-o", "ServerAliveCountMax=3", \
  "-o", "BatchMode=yes"]
