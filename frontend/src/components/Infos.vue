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
                    <el-form :model="form" label-width="auto" size="small" v-if="form && form.map_graph && form.map_graph.info">
                        <el-form-item label="地图文件">
                            <el-input v-model="form.map_graph.info.map_file_name" readonly />
                        </el-form-item>
                        
                        <el-form-item label="map_version">
                            <el-input v-model="form.map_graph.info.map_version" readonly />
                        </el-form-item>

                        <el-form-item label="graph_version">
                            <el-input v-model="form.map_graph.info.graph_version" readonly />
                        </el-form-item>
                    </el-form>

                </el-tab-pane>

                <el-tab-pane label="Wellrouting" name="Wellrouting">
                      <el-form :model="form" label-width="auto" size="small" v-if="form && form.wellrouting && form.wellrouting.info">
                        <el-form-item label="地图文件">
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
                        </el-form-item>
                    </el-form>  

                </el-tab-pane>

                <el-tab-pane label="Harden" name="Harden"></el-tab-pane>

                <el-tab-pane label="FormatService" name="FormatService"></el-tab-pane>
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

// 弹窗
const dialogFormLoading = ref(false)    // 加载数据
const dialogFormVisible = ref(false)    // 弹窗显示


type InfoData = {
    map_graph: any;
    wellrouting: any;
}

// 地图版本相关的信息
type MapVersionData = {
    module: string;
    map_file_name: string;
    map_version: string;
    graph_version: string;
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
    const keys = ["map_graph", "wellrouting"]
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
                // map的数据 - lanelet数量
                map_lanelet_count: data?.info?.lanelet_count || 0,

                // graph的数据 - 顶点数量,边数量
                graph_vertices: data?.info?.vertices || 0,
                graph_edges: data?.info?.edges || 0,
            }
})

const is_same_with_mapgraph = (key, value) => {
    const info = mapgraph_info.value
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
        ElMessage({ message: '加载成功', type: 'success' })
    } else {
        form.value = null
        ElMessage({ message: '加载失败', type: 'error' })
    }
}


const handleRefresh = async () => {
    dialogFormLoading.value = true
    try {
        await query()
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

// 在组件卸载时清理资源
onUnmounted(() => {
    //
})
</script>
