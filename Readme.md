
# ThePusher

Github post-receive hook router.

## Installation

Make sure you've [got node and npm installed](https://gist.github.com/579814) and then
run `npm i --global thepusher`.

## Use

Run `thepusher` from the command line. It does not daemonize itself, it only logs to
stdout, and it doesn't run at startup. Yet. Pull requests accepted and encouraged.

## Configuration

ThePusher's config file resides at `~/.pusher` and looks like this:

    host github.samhuri.net
    port 6177

    # a unique identifier used in the receive hook url
    token e815fb07bb390b5e47e509fd1e31e0d82e5d9c24

    # a branch named "feature" is created
    create branch feature notify-mailing-list.sh

    # any branch is deleted in a repo named "my-project"
    delete branch my-project:* notify-mailing-list.sh

    # commits are pushed to any branch on samsonjs/ThePusher, fast-forward merge
    # (e.g. https://github.com/samsonjs/ThePusher)
    merge branch samsonjs/ThePusher post-to-twitter.sh

    # someone force pushed to master in any of my projects
    force branch samsonjs/*:master send-an-angry-email.sh

    # any tag is created in "my-project"
    create tag my-project:* build-tag.sh

    # any tag is deleted in "my-project"
    delete tag my-project:* delete-build-for-tag.sh

As you may have noticed triggers follow the form:

    <action> <ref type> <owner/repo:ref> <command>
  
Actions are `create`, `delete`, `merge`, and `force`. `merge` and `force` are only
valid when the ref type is `branch`.

The ref type is `branch` or `tag`.

The ref spec consists of 1 to 3 parts, any of which can be omitted as long as at least
one of them is present. To reference the branch or tag named `staging` in the repo
named `server` owned by `samsonjs` you write `samsonjs/server:staging`. If there is one
name it's the branch or tag name, effectively `*/*:name`.

(It's not real globbing the value `*` is just special cased.)

Everything after the ref spec is the command. Commands are not quoted, just good old
terrible space splitting.

## Commands

A few environment variables are set so that commands know what triggered them.

Their names should give away their values:

 * `PUSHER_ACTION`
 * `PUSHER_OWNER`
 * `PUSHER_REPO`
 * `PUSHER_REFTYPE`
 * `PUSHER_BRANCH`
 * `PUSHER_TAG`

Only one of `PUSHER_BRANCH` or `PUSHER_TAG` will bet set, and that will correspond
with the value of `PUSHER_REFTYPE` which is either `branch` or `tag`.

## License 

(The MIT License)

Copyright (c) 2011 Sami Samhuri &lt;sami@samhuri.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.