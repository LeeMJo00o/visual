FROM uhub.service.ucloud.cn/westwell_devops/chain_boot/pp-interface-base:2025-06-09-17-15-47

WORKDIR /opt/app/
COPY . ./
RUN chmod +x run.sh
CMD ["sh", "run.sh"]
