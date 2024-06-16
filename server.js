#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const util = require("util")

const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const execS = (cmd, extra) => execSync(cmd, { encoding: "utf-8", ...extra })

app.get("/api/v1/read", async (req, res) => {
	const shouldConvertToHierarchy = "hierarchy" in req.query
	const workspaceName = req.query.workspace || "current"

	try {
		const workspace = readWorkspace(workspaceName)

		if (!workspace) {
			const msg = `workspace "${workspaceName}" not found.`
			console.warn(msg)
			return res.status(400).json({ msg })
		}

		if (!shouldConvertToHierarchy) {
			return res.status(200).send(workspace)
		} else {
			const currentParsed = JSON.parse(workspace)
			const currentInHierarchy = convertToHierarchy(currentParsed)
			return res.status(200).json(currentInHierarchy)
		}
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

function readWorkspace(workspace) {
	if (workspace === "current") {
		return readCurrentStringified()
	}

	const workspaces = listWorkspaces()

	if (!workspaces.includes(workspace)) {
		return null
	}

	const workspacePath = path.join(WORKSPACES_DIR, workspace)
	return fs.readFileSync(workspacePath)
}

function readCurrentStringified() {
	const displays = execS("yabai -m query --displays")
	const spaces = execS("yabai -m query --spaces")
	const windows = execS("yabai -m query --windows")

	/** see `read-direct` */
	const data = util.format('{"displays":%s,"spaces":%s,"windows":%s}\n', displays, spaces, windows)

	return data
}

/**
 * @mutates data
 *
 * TODO FIXME: found `null` for `window` inside `space` for the following request:
 * http://localhost:19420/api/v1/read?hierarchy&workspace=6.sp.json
 */
function convertToHierarchy(data) {
	const stats = {
		displays: data.displays.length,
		spaces: data.spaces.length,
		windows: data.windows.length,
	}

	/** convert windowIDs to full window objects */
	data.spaces = data.spaces.map(space => Object.assign(space, {
		windows: space.windows.map(windowId => {
			return data.windows.find(window => window.id === windowId)
		})
	}))

	/** convert spaceIndexes into full space objects */
	data.displays = data.displays.map(display => Object.assign(display, {
		spaces: display.spaces.map(spaceIndex => {
			return data.spaces.find(space => space.index === spaceIndex)
		})}
	))

	return {
		/** root level (has everything else) */
		displays: data.displays,
		stats,
	}
}

const WORKSPACES_DIR = path.join(__dirname, "workspaces")

app.get("/api/v1/list-workspaces", (_req, res) => {
	try {
		const workspaces = listWorkspaces()
		return res.status(200).json({ workspaces })
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

function listWorkspaces() {
	fs.mkdirSync(WORKSPACES_DIR, { recursive: true })
	const workspaces = fs.readdirSync(WORKSPACES_DIR).filter(entry => entry.includes(".sp.json"))
	return workspaces
}

function store(data, filepath) {
	const dirpath = path.dirname(filepath)

	fs.mkdirSync(dirpath, { recursive: true })
	fs.writeFileSync(filepath, JSON.stringify(data))
}

function readFromStored() {

}

/** serve static client */
app.use(express.static(path.join(__dirname, "client")))

function startServer({
	PORT = process.env.PORT || 19420
} = {}) {
	return app.listen(PORT, () => {
		const msg = `server listening on port ${PORT}`
		console.log(msg)
	})
}

module.exports = {
	startServer,
}

if (!module.parent) {
	startServer()
}
