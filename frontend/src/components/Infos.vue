<!-- infos -->
<template>
    <div>
        <el-button type="success" plain @click="handleOpen">Show</el-button>
    </div>

    <CustomDialog v-model:visible="dialogFormVisible" title="系统信息" :width="1000" :height="600" :min-width="400"
        :min-height="200" :max-width="1200" :max-height="800" :draggable="true" :resizable="true">
        
        <template #title>
            系统信息
            <el-icon style="margin-left: 10px; cursor: pointer;" @click="handleRefresh"><Refresh /></el-icon>
        </template>

        <div v-loading="dialogFormLoading">
             <el-tabs v-model="activeName" v-if="form">
                <el-tab-pane label="MapVersion" name="MapVersion">
                    <el-table :data="MapVersionData_list" stripe style="width: 100%" size="small">
                        <el-table-column prop="module" label="服务名" />
                        <el-table-column prop="map_file_name" label="地图文件名">
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('map_file_name', row.map_file_name) ? 'green' : 'red' }">
                                    {{ row.map_file_name }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="map_version" label="map_version">
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('map_version', row.map_version) ? 'green' : 'red' }">
                                    {{ row.map_version }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="map_data_version" label="map_data_version" >
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('map_data_version', row.map_data_version) ? 'green' : 'red' }">
                                    {{ row.map_data_version }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="graph_version" label="graph_version" >
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('graph_version', row.graph_version) ? 'green' : 'red' }">
                                    {{ row.graph_version }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="map_lanelet_count" label="lanelet数量">
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('map_lanelet_count', row.map_lanelet_count) ? 'green' : 'red' }">
                                    {{ row.map_lanelet_count }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="graph_vertices" label="graph顶点数量">
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('graph_vertices', row.graph_vertices) ? 'green' : 'red' }">
                                    {{ row.graph_vertices }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="graph_edges" label="graph边数量">
                            <template #default="{ row }">
                                <span :style="{ color: is_same_with_mapgraph('graph_edges', row.graph_edges) ? 'green' : 'red' }">
                                    {{ row.graph_edges }}
                                </span>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane label="MapGraph" name="MapGraph">
                    <el-form :model="form" label-width="150px" size="small" v-if="form && form.map_graph && form.map_graph.info">
                        <template v-for="(value, key) in form.map_graph.info" :key="key">
                            <el-form-item :label="key">
                                <el-input :value="value" readonly />
                            </el-form-item>
                        </template>
                        
                        
                        <!-- <el-form-item label="地图文件">
                            <el-input v-model="form.map_graph.info.map_file_name" readonly />
                        </el-form-item>
                        
                        <el-form-item label="map_version">
                            <el-input v-model="form.map_graph.info.map_version" readonly />
                        </el-form-item>

                        <el-form-item label="graph_version">
                            <el-input v-model="form.map_graph.info.graph_version" readonly />
                        </el-form-item> -->
                    </el-form>

                </el-tab-pane>

                <el-tab-pane label="Wellrouting" name="Wellrouting">
                      <el-form :model="form" label-width="150px" size="small" v-if="form && form.wellrouting && form.wellrouting.info">
                        <template v-for="(value, key) in form.wellrouting.info" :key="key">
                            <el-form-item :label="key">
                                <el-input :value="value" readonly />
                            </el-form-item>
                        </template>
                        
                        <!-- <el-form-item label="地图文件">
                            <el-input v-model="form.wellrouting.info.map_file_name" readonly />
                        </el-form-item>
                        
                        <el-form-item label="map_version">
                            <el-input v-model="form.wellrouting.info.map_version" readonly />
                        </el-form-item>

                        <el-form-item label="graph_version">
                            <el-input v-model="form.map_graph.info.graph_version" readonly />
                        </el-form-item>

                        <el-form-item label="vertices">
                            <el-input v-model="form.wellrouting.info.vertices" readonly />
                        </el-form-item>

                        <el-form-item label="edges">
                            <el-input v-model="form.wellrouting.info.edges" readonly />
                        </el-form-item> -->
                    </el-form>  

                </el-tab-pane>

                <el-tab-pane label="Harden" name="Harden"></el-tab-pane>

                <el-tab-pane label="FormatService" name="FormatService"></el-tab-pane>

                <el-tab-pane label="Envs" name="EnvVars">
                    <div class="env-filter">
                        <el-input v-model="envFilter" placeholder="搜索环境变量..." size="small" clearable style="width: 300px; margin-bottom: 10px;" />
                    </div>
                    <el-table :data="filteredEnvList" stripe style="width: 100%" size="small" max-height="400">
                        <el-table-column prop="key" label="变量名" width="280" show-overflow-tooltip />
                        <el-table-column prop="value" label="值" show-overflow-tooltip />
                    </el-table>
                </el-tab-pane>

                <el-tab-pane label="Docker" name="Docker">
                    <div class="docker-filter">
                        <el-input v-model="dockerFilter" placeholder="搜索容器..." size="small" clearable style="width: 300px; margin-bottom: 10px;" />
                    </div>
                    <template v-if="dockerList && dockerList.length > 0">
                        <el-table :data="filteredDockerList" stripe style="width: 100%" size="small" max-height="400">
                            <el-table-column prop="name" label="容器名" width="150" />
                            <el-table-column prop="image" label="镜像" show-overflow-tooltip />
                            <el-table-column prop="start_at" label="启动时间" width="140" />
                        </el-table>
                    </template>
                    <el-empty v-else description="">
                        <template #description>
                            请确保 pp_visual 服务已正确映射文件: "/var/run/docker.sock" <br />
                            检查后端接口 "/api/maintain/server_info"
                        </template>
                    </el-empty>
                </el-tab-pane>
            </el-tabs>
            
            <span v-else>
                没有数据
            </span>
        </div>
    </CustomDialog>
</template>


<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios';
import CustomDialog from './CustomDialog.vue'
import { Refresh } from '@element-plus/icons-vue'


const activeName = ref('MapVersion')

// 服务器信息相关
const serverInfo = ref<{
    env: Record<string, string>;
    docker: Array<{ name: string; image: string; start_at: string }>;
} | null>(null)

// 环境变量过滤
const envFilter = ref('')

// docker 过滤
const dockerFilter = ref('')

// 环境变量列表
const envList = computed(() => {
    if (!serverInfo.value?.env) return []
    return Object.entries(serverInfo.value.env).map(([key, value]) => ({
        key,
        value
    })).sort((a, b) => a.key.localeCompare(b.key))
})

// 过滤后的环境变量列表
const filteredEnvList = computed(() => {
    if (!envFilter.value) return envList.value
    const filter = envFilter.value.toLowerCase()
    return envList.value.filter(item => 
        item.key.toLowerCase().includes(filter) || 
        item.value.toLowerCase().includes(filter)
    )
})

// 容器列表
const dockerList = computed(() => {
    if (!serverInfo.value?.docker) return []
    return serverInfo.value.docker
})

// 过滤后的容器列表
const filteredDockerList = computed(() => {
    if (!dockerFilter.value) return dockerList.value
    const filter = dockerFilter.value.toLowerCase()
    return dockerList.value.filter(item =>
        item.name.toLowerCase().includes(filter) ||
        item.image.toLowerCase().includes(filter) ||
        item.start_at.toLowerCase().includes(filter)
    )
})

// 弹窗
const dialogFormLoading = ref(false)    // 加载数据
const dialogFormVisible = ref(false)    // 弹窗显示


type InfoData = {
    map_graph: any;
    wellrouting: any;
}

type InfoKey = keyof InfoData

// 地图版本相关的信息
type MapVersionData = {
    module: string;
    map_file_name: string;
    map_version: string;
    graph_version: string;
    map_data_version: string;
    // map的数据 - lanelet数量
    map_lanelet_count: number;

    // graph的数据 - 顶点数量,边数量
    graph_vertices: number;
    graph_edges: number;

}

// 权重数据
const form = ref<InfoData | null>(null)

// 各模块的地图 graph相关的数据, 封装为列表, 使用
const MapVersionData_list = computed(() => {
    let list = []
    const keys: InfoKey[] = ["map_graph", "wellrouting"]
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const data = form.value?.[key] || null
        // console.log("key=", key, "  data=", data)
        if (data) {
            const item = {
                module: key,
                map_file_name: data?.info?.map_file_name || "",
                map_version: data?.info?.map_version || "",
                graph_version: data?.info?.graph_version || "",
                map_data_version: data?.info?.map_data_version || "",
                // map的数据 - lanelet数量
                map_lanelet_count: data?.info?.lanelet_count || 0,

                // graph的数据 - 顶点数量,边数量
                graph_vertices: data?.info?.vertices || 0,
                graph_edges: data?.info?.edges || 0,
            }
            list.push(item)
        }
    }
    return list
})

// map_graph的info, 作为对比的源数据
const mapgraph_info = computed(()=> {
    const key = "map_graph"
    const data = form.value?.[key] || null
    return {
                module: key,
                map_file_name: data?.info?.map_file_name || "",
                map_version: data?.info?.map_version || "",
                graph_version: data?.info?.graph_version || "",
                map_data_version: data?.info?.map_data_version || "",
                // map的数据 - lanelet数量
                map_lanelet_count: data?.info?.lanelet_count || 0,

                // graph的数据 - 顶点数量,边数量
                graph_vertices: data?.info?.vertices || 0,
                graph_edges: data?.info?.edges || 0,
            }
})

type MapGraphInfo = {
    module: string;
    map_file_name: any;
    map_version: any;
    graph_version: any;
    map_data_version: any;
    map_lanelet_count: any;
    graph_vertices: any;
    graph_edges: any;
}

type MapGraphCompareKey = keyof MapGraphInfo

const is_same_with_mapgraph = (key: MapGraphCompareKey, value: unknown) => {
    const info = mapgraph_info.value as MapGraphInfo
    console.log("mapgraph_info=", info)
    if(value && info && info?.[key] !== value) {
        console.log("key=", key, "  value=", value, "  info[key]=", info?.[key])
        return false
    }else{
        return true
    }
}

const query = async () => {
    const response = await axios.get('/api/infos/')
    // console.log("query infos response:", response)
    if (response.status === 200 && response.data.code === 200 && response.data.data) {
        let data = response.data.data
        form.value = data
        ElMessage({ message: '查询系统信息成功', type: 'success' })
    } else {
        form.value = null
        ElMessage({ message: '查询系统信息出错', type: 'error' })
    }
}

// 查询服务器信息（环境变量和容器）
const queryServerInfo = async () => {
    try {
        const response = await axios.get('/api/maintain/server_info')
        if (response.status === 200 && response.data.code === 200 && response.data.data) {
            serverInfo.value = response.data.data
        } else {
            serverInfo.value = null
        }
    } catch (error) {
        console.log("query server info error: ", error)
        serverInfo.value = null
    }
}


const handleRefresh = async () => {
    dialogFormLoading.value = true
    try {
        await Promise.all([query(), queryServerInfo()])
    } catch (error) {
        console.log("query infos error: ", error)
        // 提示
        ElMessage.error('加载数据失败')
    } finally {
        dialogFormLoading.value = false
    }
}

const handleOpen = async () => {
    dialogFormVisible.value = true
    handleRefresh()
}

// 暴露方法供父组件调用
defineExpose({
    handleOpen
})

// 在组件卸载时清理资源
onUnmounted(() => {
    //
})
</script>
