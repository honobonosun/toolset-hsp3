# toolset-hsp3 README

An extension to automate hsp3root path configuration.

## Features

This extension provides three functions.

(1) Search for installed HSP3 using the node-glob pattern.

(2) It will let you choose one of the HSP3 environments it finds.

(3) Other extensions can get the path of the environment selected in (2) from the public API.

Once you install this extension, your VSCode will be able to find HSP3, even if you are not familiar with the file system, as long as HSP3 is installed by the installer to default path.

In order to be detected in a Wine environment, you need to set the glob pattern to a location equivalent to "C:\hsp\*\hsp3cl.exe".

## Requirements

- Installed HSP3.5 (and above) for windows on your PC.

## Extension Settings

### toolset-hsp3.paths.search

Write a glob pattern to search for the installed HSP3 to string type array.

Since it is an array, you can write multiple glob patterns.

**Node-glob on Windows cannot use a backslash as a path separator.**

You can read about other specifications in the [repository](https://github.com/isaacs/node-glob#windows).

### toolset-hsp3.path

The path of the hsp3root selected for the current project.

This value varies depending on your PC environment, so do not share it with others.

### toolset-hsp3.path.globalSave

If this setting is true, the HSP3 environment selection will be saved in the PC itself.

If you want to save the path selection to the project, set it to false.

### toolset-hsp3.tool.launch.cwd

To change the current directory of the Task Runner, change this setting.

It does not matter if this setting is not set. The task runner will use the default current directory.

### toolset-hsp3.useWine

You can specify via wine in the task runner.

To use this setting, Wine must be installed beforehand.

## License

### toolset-hsp3

MIT license 2022-02-26 Honobono

### [node-glob](https://github.com/isaacs/node-glob)

The ISC License

Copyright (c) Isaac Z. Schlueter and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

\#\# Glob Logo

Glob's logo created by Tanya Brassie <http://tanyabrassie.com/>, licensed
under a Creative Commons Attribution-ShareAlike 4.0 International License
https://creativecommons.org/licenses/by-sa/4.0/
