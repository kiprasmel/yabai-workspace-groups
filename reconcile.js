#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const cp = require("child_process")

// const TARGET = $1

// const DELTA = ./compare // or call json-diff as module in js?

function reconcile({ targetFile }) {
	const { target, current } = parseWorkspacesData({ targetFile })

	const targetDisplays = target.displays
	const currentDisplays = current.displays
	const targetDisplaysSpaces = targetDisplays.map(x => x.spaces)
	const currentDisplaysSpaces = currentDisplays.map(x => x.spaces)
	console.log({ targetDisplays, currentDisplays, targetDisplaysSpaces, currentDisplaysSpaces })

	const currentSpaceToDisplayMap = new Map()
	for (const display of currentDisplays) {
		for (const space of display.spaces) {
			if (currentSpaceToDisplayMap.has(space)) {
				const existingDisplay = currentSpaceToDisplayMap.get(space)
				const msg = `space idx ${space} already exists in display ${existingDisplay}`
				throw new Termination(msg)
			}

			currentSpaceToDisplayMap.set(space, display.uuid)
		}
	}

	const spacesToMoveToDesktop = []
	for (let i = 0; i < targetDisplays.length; i++) {
		const targetDisplay = targetDisplays[i]

		for (const space of targetDisplay.spaces) {
			const currDisplayUUID = currentSpaceToDisplayMap.get(space)
			const needsToBeMoved = currDisplayUUID !== targetDisplay.uuid

			if (needsToBeMoved) {
				spacesToMoveToDesktop.push([space, targetDisplay.uuid])
			}
		}
	}

	console.log({ spacesToMoveToDesktop })

	/**
	 * TODO: what to do if display is not available?
	 * e.g. user selected some config w/ 2 monitors, but 1 is unplugged.
	 */

	for (const [space, displayUUID] of spacesToMoveToDesktop) {
		const display = currentDisplays.find(x => x.uuid === displayUUID)

		if (!display) {
			const msg = `uuid of target display does not exist in current displays. ${displayUUID}`
			throw new Termination(msg)
		}

		moveSpaceToDisplay(space, display.id)
	}

	const windowsToMoveToSpaces = []
	for (const window of windowsToMoveToSpaces) {
		moveWindowToSpace(window)
	}
}

function parseWorkspacesData({ targetFile }) {
	const target = JSON.parse(fs.readFileSync(targetFile, { encoding: "utf-8" }))

	const readDirectScriptPath = path.join(__dirname, "read-direct")
	const current = JSON.parse(cp.execSync(readDirectScriptPath, { encoding: "utf-8" }))

	return {
		target,
		current,
	}
}

function moveSpaceToDisplay(space, display) {
	const cmd = `yabai -m space ${space} --display ${display}`

	cp.execSync(cmd)
}

function moveWindowToSpace(window) {
	TODO()
}

function reconcile_cli(argv = process.argv.slice(2)) {
	try {
		const opts = parseArgv(argv)
		reconcile(opts)
	} catch (e) {
		if (e instanceof Termination) {
			process.stderr.write("\n" + e.message + "\n\n")
			process.exit(1)
		} else {
			throw e
		}
	}
}

function parseArgv(argv) {
	const opts = {}

	const eat = () => argv.shift()

	if (!argv.length) {
		const msg = `target file is required`
		throw new Termination(msg)
	}

	if (argv.length === 1) {
		opts.targetFile = eat()
		return opts
	}

	while (argv.length) {
		TODO()
	}

	return opts
}

function TODO() {
	throw new Error("not implemented")
}

class Termination extends Error {}

if (!module.parent) {
	reconcile_cli()
}
