workflow "Install and lint" {
  on = "push"
  resolves = [
    "Lint project"
  ]
}

action "Don't skip CI" {
  uses = "ffflorian/actions/last_commit@master"
  args = "^(?:(?!\\[(ci skip|skip ci)\\]).)*$"
}

action "Install dependencies" {
  uses = "ffflorian/actions/git-node@master"
  needs = "Don't skip CI"
  runs = "yarn"
}

action "Lint project" {
  uses = "ffflorian/actions/git-node@master"
  needs = "Install dependencies"
  runs = "yarn"
  args = "lint"
}
