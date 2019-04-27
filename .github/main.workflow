workflow "Install and lint" {
  on = "push"
  resolves = "Lint project"
}

action "Don't skip CI" {
  uses = "ffflorian/actions/last_commit@master"
  args = "^(?:(?!\\[(ci skip|skip ci)\\]).)*$"
}

action "Install dependencies" {
  uses = "docker://node:11-slim"
  needs = "Don't skip CI"
  runs = "yarn"
}

action "Lint project" {
  uses = "docker://node:11-slim"
  needs = "Install dependencies"
  runs = "yarn"
  args = "lint"
}
