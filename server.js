#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const util = require("util")

const express = require("express")
const cors = require("cors")

const { moveWindowToSpace } = require("./reconcile")

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const execS = (cmd, extra) => execSync(cmd, { encoding: "utf-8", ...extra })

/**
 * query params:
 * - id: unique name of the workspace
 * - forceOverwrite: if should write new data to an already existing workspace id
 * - current: if instead of providing workspace data, should read current state & store that
*/
app.post("/api/v1/store", async (req, res) => {
	try {
		let wsId = req.query.id

		if (!wsId) {
			const msg = "workspace 'id' missing from request query params"
			return res.status(400).json({ msg })
		}

		if (!wsId.includes(WORKSPACE_SUFFIX)) {
			wsId = wsId + WORKSPACE_SUFFIX
		}

		const wss = listWorkspaces()
		const forceOverwrite = boolQueryParam(req, "forceOverwrite")

		if (wss.includes(wsId) && !forceOverwrite) {
			const msg = "provided workspace 'id' already exists, but 'forceOverwrite' query param was not provided."
			return res.status(400).json({ msg })
		}

		const data = req.body
		const hasData = data && Object.keys(data).length > 0;
		const current = boolQueryParam(req, "current")
		console.log({data, hasData, current})

		if (!hasData && !current) {
			const msg = "no workspace data provided. provide query param 'current' if want to store the current layout."
			return res.status(400).json({ msg })
		} else if (hasData && current) {
			const msg = "both data and 'current' query param provided, choose only one."
			return res.status(400).json({ msg })
		} else if (hasData) {
			storeWorkspace(data, wsId)
			return res.status(200).json({ msg: "stored successfully, used *provided* data" })
		} else if (current) {
			const curr = JSON.parse(readWorkspace("current"))
			storeWorkspace(curr, wsId)
			return res.status(200).json({ msg: "stored successfully, used *current* data" })
		} else {
			throw new Error("impossible")
		}
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

function storeWorkspace(data, workspaceId) {
	const filepath = path.join(ensureWorkspacesDir(), workspaceId)
	fs.writeFileSync(filepath, JSON.stringify(data))
}

function boolQueryParam(req, param) {
	return param in req.query && req.query[param] !== "0"
}

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
		windowsMinimized: -1,
		windowsNonMinimized: data.windows.filter(x => !x["is-minimized"]).length,
	}

	stats.windowsMinimized = stats.windows - stats.windowsNonMinimized

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
const WORKSPACE_SUFFIX = ".sp.json"

app.get("/api/v1/list-workspaces", (_req, res) => {
	try {
		const workspaces = listWorkspaces()
		return res.status(200).json({ workspaces })
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

function ensureWorkspacesDir() {
	fs.mkdirSync(WORKSPACES_DIR, { recursive: true })
	return WORKSPACES_DIR
}

function listWorkspaces() {
	ensureWorkspacesDir()
	const workspaces = fs.readdirSync(WORKSPACES_DIR).filter(entry => entry.includes(".sp.json"))
	return sortWorkspaces(workspaces)
}

function sortWorkspaces(xs) {
	return xs.sort((A, B) => Number(A.split(".")[0]) - Number(B.split(".")[0]));
}

app.post("/api/v1/move-windows", async (req, res) => {
	try {
		const data = req.body

		if (!data || !data.length || !data.every(x => x.length === 2)) {
			const msg = "request body format should be [windowId, spaceIndex][]."
			return res.status(400).json({ msg })
		}

		const failures = []
		for (const [windowId, spaceIdx] of data) {
			// TODO: individual try-catch w/ retry logic?
			try {
				moveWindowToSpace(windowId, spaceIdx)
			} catch (e) {
				failures.push(e)
			}
		}

		if (failures.length > 0) {
			const msg = "encountered failures while moving some windows."
			return res.status(500).json({ msg, failures })
		}

		const msg = "successfully moved windows with 0 failures."
		return res.status(200).json({ msg })
	} catch (err) {
		console.error(err)
		return res.status(500).json({ err })
	}
})

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
