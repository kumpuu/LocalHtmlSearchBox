import os
import sys
import gen_database as gendb
import json
from shutil import copyfile, copytree, move
import re


def run_cmd(cmd):
    cmd_pipe = os.popen(cmd)
    cmd_print = cmd_pipe.read()
    print(cmd_print)


if __name__ == '__main__':
    if len(sys.argv) == 1:
        print("Usage: gen_javadoc.py path")
        quit()

    database_dir = sys.argv[1]
    if database_dir[-1] != r"/" or database_dir[-1] != "\\":
        database_dir = database_dir + "/"

    if not os.path.exists(database_dir):
        print(database_dir + " is not a valid path")
        quit()

    # Read the html documents under /com to generate json data to a .js
    def on_read_file(path, resultArr):
        if 'html' in path:
            url = path[path.index(database_dir) + len(database_dir):]
            url = url.replace('\\', '/')
            resultArr.extend(gendb.simple_read_one(path, url))

    result_arr = []
    print("Reading files, may take a while...")
    gendb.read_files(database_dir + 'com/', on_read_file, result_arr)
    gendb.remove_same(result_arr)

    s_dir = database_dir + "search/"
    copytree("./search", s_dir, dirs_exist_ok=True)

    print("Dumping results...")
    with open(s_dir + 'searchData.js', 'w') as fl:
        fl.write("var searchData = " + json.dumps(result_arr))
        fl.close()

    move(s_dir + "index-searchable.html", database_dir + "index-searchable.html")
    
    if os.path.isfile(database_dir + "index.html"):
        copyfile(database_dir + "index.html", s_dir + "index.html.js")
        
        with open(s_dir + "index.html.js", 'r') as original: data = original.read()
        with open(s_dir + "index.html.js", 'w') as modified:
            modified.write("//this is a workaround to get around the stupid same-origin policy and enable navigation\n")
            modified.write("document.getElementById('docFrame').srcdoc = `")
            modified.write(re.sub(r'([\s}>)"])(top\.)', r'\1window.', data)) #replace top references to prevent errors
            modified.write("`")
    else:
        print("Warning: no index.html found")

    print("Done")