const core = require('@actions/core');
const github = require('@actions/github');

const listWorkflowRuns = async (filters) => {
    const octokit = github.getOctokit(core.getInput('github_token'));
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    const { data: { workflow_runs = [] } } = await octokit.actions
        .listWorkflowRuns({
            owner,
            repo,
            ...filters,
        });

    return workflow_runs;
};

const findSuccessfulWorkflowsByTagAndTagPattern = async (workflowId, currentTag, tagPattern) => {
    const matcher = new RegExp(tagPattern);
    const workflowRuns = await listWorkflowRuns({
        workflow_id: workflowId,
        event: 'push',
        status: 'success',
        per_page: 100,
    });

    core.info(`findSuccessfulWorkflowsByTagAndTagPattern parameters: "${currentTag}" "${tagPattern}"`)
    core.info(`Number of workflows founds: ${workflowRuns.length}`);

    const { head_commit: { id = '' } = {} } =
        workflowRuns.find(({ head_branch }) => matcher.test(head_branch) && head_branch !== currentTag)

    return id;
}

const findSuccessfulWorkflowByBranch = async (workflowId, branch) => {
    const workflowRuns = await listWorkflowRuns({
        workflow_id: workflowId,
        branch,
        event: 'push',
        status: 'success',
        per_page: 1,
    });

    if (workflowRuns.length > 0) {
        return workflowRuns[0].head_commit.id;
    }

    return '';
}

(async () => {
    try {
        const branch = core.getInput('branch');
        const currentTag = core.getInput('current_tag');
        const tagPattern = core.getInput('tag_pattern');
        const workflowId = core.getInput('workflow_id');

        core.info(`Actions params: "${currentTag}" "${tagPattern}"`);

        if (currentTag && tagPattern) {
            return core.setOutput('commit_hash', await findSuccessfulWorkflowsByTagAndTagPattern(workflowId, currentTag, tagPattern));
        }

        if (branch) {
            return core.setOutput('commit_hash', await findSuccessfulWorkflowByBranch(workflowId, branch));
        }

        return core.setOutput('commit_hash', '');
    } catch (e) {
        core.setFailed(e.message);
    }
})();
