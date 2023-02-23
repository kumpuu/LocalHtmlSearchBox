# coding: utf-8
from bs4 import BeautifulSoup
import bs4
import os
import sys
import re

pattern = re.compile(r"^(Interface|Class|Enum) (.+)$")

def read_one_file(url, inputContent, resultArr, filterArr):
    soup = BeautifulSoup(inputContent, features="html.parser")
    level = 0
    anchorSet = set([])
    _iterate_nodes(soup, url, level, anchorSet, resultArr, filterArr)
    # print('anchorSet:', anchorSet)


def _iterate_nodes(soup, url, level, anchorSet, resultArr, filterArr):
    for item in soup.children:
        if isinstance(item, bs4.element.Tag):
            # Collect href
            if item.name == 'a' and item.attrs.__contains__('href'):
                attrHref = item.attrs['href']
                if '#' in attrHref:
                    anchorSet.add(attrHref[attrHref.index('#')+1:])

            # change url
            if item.attrs.__contains__('id'):
                itemId = item.attrs['id']
                if itemId in anchorSet:
                    url = _update_url(url, itemId)

            # change url
            if item.name == 'a' and item.attrs.__contains__('name'):
                url = _update_url(url, item.attrs['name'])

            # Continue iterate
            _iterate_nodes(item, url, level+1, anchorSet, resultArr, filterArr)

        if item is not None and isinstance(item, bs4.element.NavigableString):
            if not _is_match(filterArr, item):
                continue

            itemStr = str(item).strip()

            if itemStr != "" and len(itemStr) >= 3:
                if not (itemStr.startswith("<!--") and itemStr.endswith("-->")): #ignore html comment
                    _type = findItemType(item, url, itemStr)
                    resultArr.append(_create_item(url, itemStr, _type))

def findItemType(item, url, itemStr):
    if (itemStr.replace(".", "/") + "/package-frame.html") == url:
        return "pkg"

    match = pattern.match(itemStr)
    if match:
        ty = match.group(1)
        name = match.group(2)

        if url.endswith("/" + name + ".html"):
            p = item.parent
            if p.name == "h2" and "title" in p["class"]:
                return ty[:3].lower()

    return None

def _update_url(url, anchor):
    if '#' in url:
        url = url[:url.index('#')]
    url = url + '#' + anchor
    return url

def _is_match(filter_arr, node):
    for nodefilter in filter_arr:
        if not nodefilter(node):
            return False
    return True

def _create_item(url, content, _type):
    makeJson = {}
    makeJson['url'] = url
    makeJson['content'] = content
    if not _type is None:
        makeJson['type'] = _type
    return makeJson

def progress_bar(caption, current, total, bar_length=20):
    fraction = current / total

    arrow = int(fraction * bar_length - 1) * '-' + '>'
    padding = int(bar_length - len(arrow)) * ' '

    ending = '\n' if current == total else '\r'

    print(f'{caption}: [{arrow}{padding}] {int(fraction*100)}%', end=ending)

def remove_same(srcArr):
    def s_key(itm):
        return itm['url']

    list.sort(srcArr, key=s_key)

    def cmp_key(key, a, b):
        val_a = a[key] if key in a else None
        val_b = b[key] if key in b else None

        return val_a == val_b

    i = 0
    while i < len(srcArr) - 1:
        progress_bar("Checking dupes", i, len(srcArr))

        item = srcArr[i]

        j = i + 1
        while j < len(srcArr):
            nxt_item = srcArr[j]

            if nxt_item['url'] != item['url']:
                break

            if (nxt_item['content'] == item['content']) and cmp_key('type', nxt_item, item):
                srcArr.pop(j)
                continue
                
            j += 1

        i += 1

    progress_bar("Checking dupes", 1, 1)


def read_files(directory, on_read_file, *arg):
    _recursive_read_files(directory, on_read_file, *arg)

def _recursive_read_files(path, on_read_fl, *arg):
    if os.path.isdir(path):
        for file_in_dir in os.listdir(path):
            _recursive_read_files(os.path.join(path, file_in_dir), on_read_fl, *arg)

    else:
        on_read_fl(path, *arg)

def simple_read_one(path, url, custom_filter_arr=[]):
    """
    Args:
        path: the path of the file
        url: the url of the search item
        custom_filter_arr: an array that contains filter function function_name(node). The node is a node of bs4
    """
    arr = []
    filter_arr = [not_allow_tags_filter, not_allow_content_filter, not_allow_type_filter]
    if len(custom_filter_arr) > 0:
        filter_arr.extend(custom_filter_arr)
    read_one_file(url, open(path, 'r', encoding='utf-8'), arr, filter_arr)
    return arr


def not_allow_content_filter(node):
    not_allow_prefix_arr = [
        '\n<div>JavaScript is disabled on your browser.</div>']
    content = node.string
    for not_allow_prefix in not_allow_prefix_arr:
        if content is not None and content.lower().startswith(not_allow_prefix.lower()):
            return False
    return True


def not_allow_type_filter(node):
    if isinstance(node, bs4.element.Comment) or isinstance(node, bs4.element.Doctype):
        return False
    return True


def not_allow_tags_filter(node):
    tagName = node.parent.name
    if tagName == 'meta' or tagName == 'style':
        print('not allow:', tagName)
        return False
    return True
