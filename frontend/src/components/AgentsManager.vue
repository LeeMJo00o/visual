<template>
  <el-button plain @click="dialogVisible = true"> Open Custom Dialog </el-button>

  <CustomDialog
    v-model:visible="dialogVisible"
    title="Vehicle List"
    :width="600"
    :height="400"
    :min-width="400"
    :min-height="300"
    :max-width="1200"
    :max-height="800"
    :draggable="true"
    :resizable="true"
  >
    <div class="dialog-content">
      <span>This is a custom dialog without overlay!</span>
      <p>You can interact with the main interface while this dialog is open.</p>
      <div class="feature-list">
        <h4>Features:</h4>
        <ul>
          <li>✅ No overlay - doesn't block main interface</li>
          <li>✅ Draggable from title bar</li>
          <li>✅ Can be dragged outside browser window</li>
          <li>✅ Resizable from left, right, bottom edges</li>
          <li>✅ Resizable from corner</li>
          <li>✅ ESC key to close</li>
          <li>✅ Boundary constraints</li>
          <li>✅ Smooth animations</li>
          <li>✅ Mobile responsive</li>
          <li>✅ Mouse wheel scrolling support</li>
        </ul>
      </div>

      <!-- 添加更多内容来测试滚动 -->
      <div class="test-content">
        <h4>Test Content for Scrolling:</h4>
        <p>This is a test paragraph to demonstrate mouse wheel scrolling functionality.</p>
        <p>You should be able to use your mouse wheel to scroll through this content.</p>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua.
        </p>
        <p>
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
          commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
          nulla pariatur.
        </p>
        <p>
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
          anim id est laborum.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
          laudantium.
        </p>
        <p>
          Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae
          vitae dicta sunt explicabo.
        </p>
        <p>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
          consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
        </p>
        <p>
          Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
          velit.
        </p>
        <p>
          Sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
          voluptatem.
        </p>
        <p>
          Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam,
          nisi ut aliquid ex ea commodi consequatur?
        </p>
        <p>
          Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae
          consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?
        </p>
        <p>
          At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium
          voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati
          cupiditate non provident.
        </p>
        <p>
          Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum
          fuga.
        </p>
        <p>Et harum quidem rerum facilis est et expedita distinctio.</p>
        <p>
          Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id
          quod maxime placeat facere possimus.
        </p>
        <p>Omnis voluptas assumenda est, omnis dolor repellendus.</p>
        <p>
          Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet
          ut et voluptates repudiandae sint et molestiae non recusandae.
        </p>
        <p>
          Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores
          alias consequatur aut perferendis doloribus asperiores repellat.
        </p>
        <p>
          End of test content. You should have been able to scroll through all of this using your
          mouse wheel!
        </p>
      </div>
    </div>
  </CustomDialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import CustomDialog from './CustomDialog.vue'

const dialogVisible = ref(false)
</script>

<style scoped>
.dialog-content {
  padding: 10px;
}

.feature-list {
  margin-top: 20px;
}

.feature-list h4 {
  margin-bottom: 10px;
  color: #409eff;
}

.feature-list ul {
  list-style: none;
  padding: 0;
}

.feature-list li {
  padding: 5px 0;
  color: #606266;
}

.test-content {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #409eff;
}

.test-content h4 {
  color: #409eff;
  margin-bottom: 10px;
}

.test-content p {
  margin: 8px 0;
  line-height: 1.6;
  color: #606266;
}
</style>
