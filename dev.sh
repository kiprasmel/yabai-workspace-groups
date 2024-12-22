#!/usr/bin/env bash

DIRNAME="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"

$DIRNAME/server.js

