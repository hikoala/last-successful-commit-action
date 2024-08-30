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

async function* paginateWorkflowRuns(filters) {
    const octokit = github.getOctokit(core.getInput('github_token'));
    const [owner, repo] = ['hikoala', 'monorepo'];

    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        const { data: { workflow_runs = [], total_count } } = await octokit.actions.listWorkflowRuns({
            owner,
            repo,
            page,
            per_page: 100,
            ...filters,
        });

        yield workflow_runs;

        if (workflow_runs.length < 100 || page * 100 >= total_count) {
            hasMorePages = false;
        } else {
            page++;
        }
    }
}

const findSuccessfulWorkflowsByTagAndTagPattern = async (workflowId, currentTag, tagPattern) => {
    const matcher = new RegExp(`^${tagPattern}$`);
    const filters = {
        workflow_id: workflowId,
        event: 'push',
        status: 'success',
    };

    for await (const workflowRuns of paginateWorkflowRuns(filters)) {
        const match = workflowRuns.find(({ head_branch }) => matcher.test(head_branch) && head_branch !== currentTag);

        if (match) {
            return match.head_commit?.id || '';
        }
    }

    return '';
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

        if (currentTag && tagPattern) {
            return core.exportVariable('commit_hash', await findSuccessfulWorkflowsByTagAndTagPattern(workflowId, currentTag, tagPattern));
        }

        if (branch) {
            return core.exportVariable('commit_hash', await findSuccessfulWorkflowByBranch(workflowId, branch));
        }

        return core.exportVariable('commit_hash', '');
    } catch (e) {
        core.setFailed(e.message);
    }
})();