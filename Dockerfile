# step 1: 构建前端
FROM uhub.service.ucloud.cn/westwell_devops/chain_boot/pp-visual-base:2025-07-15-11-53-18 AS frontend-build

WORKDIR /opt/app/

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build

# step 2： 构建最终镜像
FROM uhub.service.ucloud.cn/westwell_devops/chain_boot/pp-visual-base:2025-07-15-11-53-18

WORKDIR /opt/app/
COPY . ./

COPY --from=frontend-build /opt/app/dist/ /opt/app/frontend_dist/

RUN chmod +x run.sh
CMD ["sh", "run.sh"]
