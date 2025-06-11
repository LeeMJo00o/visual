
import fileinput
import time
import traceback
from src.plugin.manager import PluginManager
from src.plugin.service import Service

def replace_content(file_path, old_text, new_text):
    """
    替换文件中指定的内容

    参数:
        file_path (str): 文件路径
        old_text (str): 要替换的旧文本
        new_text (str): 替换为的新文本
    """
    try:
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # 替换指定的内容
        updated_content = content.replace(old_text, new_text)
        
        # 将更新后的内容写回文件
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(updated_content)
        
    except Exception as e:
        print(f"发生错误: {e}: {traceback.format_exc()}")


class TestPlugins():

    @classmethod
    def setup_class(cls):
        service = Service()
        pm = PluginManager("tests/plugin_files", service)
        pm.load_plugins_all()
        pm.start_hot_reload()
        cls.pm = pm
        cls.ins = pm.get_plugin_object("the_test_plugin")
        print(f"ook")
        assert cls.ins.func_add_give_str(1, 2) != 3

    def test_single(self):

        test_cases = [
            (11, 13, "24"),
            (7, 7, "14"),
            (8, 2, "10"),
        ]

        assert self.ins.func_add_give_str(1, 2) != 3
        assert self.ins.func_add_give_str(1, 2) == "3"

        for a1, a2, rs in test_cases:
            assert self.ins.func_add_give_str(a1, a2) == rs

    def test_auto_reload(self):
        # 首先正常测试

        assert self.ins.func_add_give_str(7, 7) == "14"

        self.test_single()

        try:
            replace_content("tests/plugin_files/the_test_plugin.py", 'arg1 + arg2', 'arg1 * arg2')
            # 稍微等待，等待模块重载
            time.sleep(1)

            # 测试是否改成乘法
            
            assert self.ins.func_add_give_str(7, 7) == "49"
        except Exception:
            raise
        finally:
            replace_content("tests/plugin_files/the_test_plugin.py", 'arg1 * arg2', 'arg1 + arg2')
