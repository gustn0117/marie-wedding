# 활성 색(blue/green)을 가리키는 유일한 지점.
# webhook-deploy.sh 가 이 파일을 통째로 다시 쓰고 nginx -s reload 로 반영한다.
# 손으로 고치지 말 것 — 다음 배포 때 덮어써진다.
set $upstream_target http://web-blue:3000;
