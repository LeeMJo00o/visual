import axios from 'axios'

/**
 * 查询回放文件列表
 * @returns {Promise} 
 * {
    "data": [
        {
            "name": "replay_20250910141802.db",
            "size": 1.9  // 单位MB
        },
        {
            "name": "replay_20250910141420.db",
            "size": 1.7
        }
    ],
    "code": 200,
    "msg": ""
}
 */
export const queryReplayDBFileList = () => {
  return axios.get('/api/replay/query/db/file/list')
}

/**
 * 查询时间范围
 * @param {Object} params 参数对象
 * @param {string} params.fileName - 文件名, 需要以.db为后缀 (必填)
 * @param {string} params.uuid - uuid (选填)
 * @param {number} params.timestamp - 请求时间戳, 单位: ms (选填)
 * @returns {Promise}  response :{
  "data": {
    "start": 1757400190000,  // 单位为ms
    "end": 1757400913700     // 单位为ms
  },
  "code": 200,
  "msg": ""
}
 */
export const queryReplayTimeRange = (params) => {
  return axios.get('/api/replay/query/time/range', { params: params })
}

/**
 * 查询某一时刻的数据
 * @param {Object} params 参数对象
 * @param {string} params.fileName - 文件名 (必填)
 * @param {number} params.t - 回放时间点, 单位为: ms (必填)
 * @param {string} params.uuid - uuid (选填)
 * @param {number} params.timestamp - 请求时间戳, 单位: ms (选填)
 * @returns {Promise}
 */
export const queryReplayData = (params) => {
  return axios.get('/api/replay/get/data', { params })
}

/**
 * 查询指定时间范围的数据
 * @param {Object} params 参数对象
 * @param {string} params.fileName - 文件名, 需要以.db为后缀 (必填)
 * @param {number} params.start - 开始时间, 单位为: ms (必填)
 * @param {number} params.end - 结束时间, 单位为: ms (必填)
 * @param {string} params.uuid - uuid (选填)
 * @param {number} params.timestamp - 请求时间戳, 单位: ms (选填)
 * @returns {Promise} data[Array]
 */
export const queryReplayRangeData = (params) => {
  return axios.get('/api/replay/get/range/data', { params })
}

/**
 * 下载回放文件
 * @param {Object} params 参数对象
 * @param {string} params.fileName - 文件名 (必填)
 * @returns {Promise}  db文件压缩包,  xxx.db.tar.gz
 */
export const downloadReplayDBFile = (params) => {
  return axios.get('/api/replay/download/db/file', {
    params: params,
    responseType: 'blob', // 指定响应类型为 blob
    headers: {
      'Content-Type': 'application/octet-stream', // 请求头
      Accept: 'application/octet-stream', // 接受压缩包格式
    },
  })
}
/**
 * 上传回放文件
 * @param {File} file - 文件对象 (必填)
 * @param {string} [filename] - 文件名 (必填)
 * @returns {Promise}
 */
export const uploadReplayDBFile = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  // if (filename) {
  //   formData.append('filename', filename)
  // }

  return axios.post('/api/replay/upload/db/file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}
