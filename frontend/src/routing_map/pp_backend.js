import axios from "axios";

export class WebSocketClient {
  constructor(url, options = {}) {
    // 配置参数
    this.url = url;
    this.options = {
      reconnectLimit: 5,
      reconnectInterval: 3000,
      heartbeatInterval: 15000,
      ...options
    };

    // 状态管理
    this.socket = null;
    this.heartbeatTimer = null;
    this.messageQueue = [];
    this.isManualClose = false;

    // 事件回调
    this.eventHandlers = {
      open: [],
      message: [],
      close: [],
      error: []
    };
  }

  // 初始化连接
  connect() {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = (event) => {
      // console.log('WebSocket connected: ', event);
      this.startHeartbeat();
      this.flushMessageQueue();
      this.emit('open', event);
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
      this.emit('message', event);
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.clearHeartbeat();
      this.emit('close', event);

      if (!this.isManualClose) {
        this.reconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  // 消息处理
  handleMessage(data) {
    try {
      // 自动JSON解析
      const parsed = JSON.parse(data);
      this.options.onMessage?.(parsed);
    } catch (e) {
      // 非JSON消息直接传递
      // this.options.onMessage?.(data);
      console.log('deal message error:', e);
    }
  }

  // 发送消息（自动排队）
  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(payload);
    } else {
      this.messageQueue.push(data);
    }
  }

  // 清空消息队列
  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      this.send(this.messageQueue.shift());
    }
  }

  // 心跳检测
  startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('heart');
      } else {
        this.clearHeartbeat();
      }
    }, this.options.heartbeatInterval);
  }

  clearHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  // 重连机制
  reconnect() {

    setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  // 关闭连接
  close(code = 1000, reason) {
    this.isManualClose = true;
    this.clearHeartbeat();
    if (this.socket) {
      this.socket.close(code, reason);
    }
  }

  // 状态检查
  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // 事件管理
  on(event, handler) {
    this.eventHandlers[event].push(handler);
    return this; // 支持链式调用
  }

  emit(event, data) {
    this.eventHandlers[event].forEach(handler => handler(data));
  }

  // 销毁实例
  destroy() {
    this.close();
    this.messageQueue = [];
    this.eventHandlers = { open: [], message: [], close: [], error: [] };
    this.socket = null;
  }
}


export async function demo_get_traj(url) {
  try {
    const response = await axios.post(url, null, {
      data: {},
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });
    return response.data;
  } catch (error) {
    console.error('获取轨迹数据失败:', error);
    throw error;
  }
}

export async function get_svg_content(url, postData = {}) {
  try {
    const response = await axios.post(url, postData, {
      headers: {
        Accept: 'image/svg+xml, text/plain, */*',
      },
      responseType: 'text', // 明确返回文本
    });
    return response.data;
  } catch (error) {
    console.error('获取SVG内容失败:', error);
    throw error;
  }
}

export async function get_map_config(url = '/api/map/config') {
  try {
    const response = await axios.post(url, {}, {
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    return response.data;
  } catch (error) {
    console.error('获取地图配置失败:', error);
    throw error;
  }
}

export async function get_path_info(url = '/api/map/path_info') {
  try {
    const response = await axios.post(url, {}, {
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    return response.data;
  } catch (error) {
    console.error('获取路径信息失败:', error);
    throw error;
  }
}
