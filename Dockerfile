FROM uhub.service.ucloud.cn/westwell_devops/chain_boot/pp-visual-base:2025-06-11-23-21-17

WORKDIR /opt/app/
COPY . ./

WORKDIR /opt/app/frontend

COPY frontend/package*.json ./

RUN npm ci \
    && npm run build \
    && npm cache clean --force \
    && rm -rf node_modules \
    && mkdir -p /opt/app/frontend_dist \
    && cp -rdf dist/* /opt/app/frontend_dist/ \
    && rm -rf dist

WORKDIR /opt/app/

RUN chmod +x run.sh
CMD ["sh", "run.sh"]
