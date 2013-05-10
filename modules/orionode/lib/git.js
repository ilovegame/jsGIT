/*******************************************************************************
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global Buffer console module process require*/
var compat = require('./compat');
var connect = require('connect');
var fs = require('fs');
var git = require('gitnode');
var path = require('path');
var url = require('url');
var api = require('./api'), write = api.write, writeError = api.writeError;
var fileUtil = require('./fileUtil'), ETag = fileUtil.ETag;
var resource = require('./resource');
var USER_WRITE_FLAG = parseInt('0200', 8);
var USER_EXECUTE_FLAG = parseInt('0100', 8);
var ph = require('path');
var lastReqPath = null;
/*
 *
 * Module begins here
 *
 */
 
function doJob(handler, rest, req, res, workspaceDir) {
	//TODO handle invalid requests
	//console.log(handler);
    //console.log(res);
    console.log('doJob:');
    console.log(rest);
	var methodName = rest[0] === '/' ? rest.split('/')[1] : rest.split('/')[0];
	var method = handler[methodName];
	var queryData = "";

	req.on('data', function(data) {
		queryData += data;
	});
	req.on('end', function() {
		var json = null;
		if (queryData.length > 0)
		{
			json = JSON.parse(queryData);
		}
		method(res, rest, json, workspaceDir);
	});
}

module.exports = function(options) {
	console.log("OPT: " );
    console.log(options);
	console.log("OPT: ");
    //console.log(opt);
    
	var fileRoot = options.root;
	var workspaceDir = options.workspaceDir;
	/*
	 * Handler begins here
	 */
	return connect()
	.use(connect.json())
	.use(resource(fileRoot, {
		GET: function(req, res, next, rest) {
			var handler = getHandlers;

            lastReqPath = req.path;

            lastReqPath = req._parsedUrl;

			doJob(handler, rest, req, res, workspaceDir);
		},

		POST: function(req, res, next, rest) {
			var handler = postHandlers;
			doJob(handler, rest, req, res, workspaceDir);
			
		},
		DELETE: function(req, res, next, rest) {
			var handler = deleteHandlers;
			doJob(handler, rest, req, res, workspaceDir);
		},
	
		PUT: function(req, res, next, rest) {
			var handler = putHandlers;
			doJob(handler, rest, req, res, workspaceDir);
		},
	}));
};

getHandlers = {
	branch : getBranch,
	clone : getClone,
	commit : getCommit,
	config : getConfig,
	diff : getDiff,
	index : getIndex,
	remote : getRemote,
	status : getStatus,
	tag : getTag
};
putHandlers = {
	branch : putBranch,
	clone : putClone,
	commit : putCommit,
	config : putConfig,
	diff : putDiff,
	index : putIndex,
	remote : putRemote,
	status : putStatus,
	tag : putTag
};
postHandlers = {
	branch : postBranch,
	clone : postClone,
	commit : postCommit,
	config : postConfig,
	diff : postDiff,
	index : postIndex,
	remote : postRemote,
	status : postStatus,
	tag : postTag
};
deleteHandlers = {
	branch : deleteBranch,
	clone : deleteClone,
	commit : deleteCommit,
	config : deleteConfig,
	diff : deleteDiff,
	index : deleteIndex,
	remote : deleteRemote,
	status : deleteStatus,
	tag : deleteTag
};

function getBranch(res, rest, dataJson, workspaceDir) {
        var repoName = rest.split('/');
        repoName = repoName[repoName.length - 2];
        var pathToRepo = workspaceDir + '/' + repoName + '/.git';
        git.gitBranchCommand.getBranchesMetadata(pathToRepo, function (err, branchesList) {
            if (err) {
                writeError(500, res, err);
                return;
            }
            var selectedBranch;
            if (rest.split('/').length == 4) {
                selectedBranch = ""
            } else {
                var parts = rest.split('/');
                selectedBranch = parts[parts.length - 4];
            }

            var dataToResponse;

            if (selectedBranch) {
                for (var branchName in branchesList) {
                    if (branchName != selectedBranch) {
                        continue;
                    }
                    dataToResponse = {
                        "CloneLocation": "/gitapi/clone/file/" + repoName + "/",
                        "CommitLocation": "/gitapi/commit/refs%252heads%252" + branchName + "/file/" + repoName + "/",
                        "Current": branchesList[branchName]['active'],
                        "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
                        "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
                        "Name": branchName,
                        "RemoteLocation": "/gitapi/remote/origin/" + branchName + "/file/" + repoName + "/",
                        "Type": "Branch"
                    }
                    break;
                }
            } else {
                var branchesInfo = new Array();
                for (var branchName in branchesList) {
                    branchesInfo.push(
                        {
                            "CloneLocation": "/gitapi/clone/file/" + repoName + "/",
                            "CommitLocation": "/gitapi/commit/refs%252heads%252" + branchName + "/file/" + repoName + "/",
                            "Current": branchesList[branchName]['active'],
                            "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
                            "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
                            "Name": branchName,
                            "RemoteLocation": "/gitapi/remote/origin/" + branchName + "/file/" + repoName + "/",
                            "Type": "Branch"
                        }
                    );
                }
                var dataToResponse = {
                    "Children": branchesInfo
                }
            }
            

            write(200, res, null, JSON.stringify(dataToResponse));
            return;
        });
}

function getClone(res, rest, dataJson, workspaceDir) {
    // /gitapi/clone/file/re/
    // /gitapi/clone/workspace

    function sendResponse(repositories)
    {
        var entries = [ ];
        repositories.forEach(function (repository) {
            var entry = {
                'BranchLocation': '/gitapi/branch/file/' + repository + '/', 
                'CommitLocation': '/gitapi/commit/file/' + repository + '/', 
                'ConfigLocation': '/gitapi/config/clone/file/' + repository + '/', 
                'ContentLocation': '/file/' + repository + '/', 
                'DiffLocation': '/gitapi/diff/Default/file/' + repository + '/', 
                'HeadLocation': '/gitapi/commit/HEAD/file/' + repository + '/', 
                'IndexLocation': '/gitapi/index/file/' + repository + '/', 
                'Location': '/gitapi/clone/file/' + repository + '/', 
                'Name': repository,
                'RemoteLocation': '/gitapi/remote/file/' + repository + '/', 
                'StatusLocation': '/gitapi/status/file/' + repository + '/', 
                'TagLocation': '/gitapi/tag/file/' + repository + '/', 
                'Type': 'Clone' 
            }
            entries.push(entry);
        });

        var json = JSON.stringify( { 'Children' : entries, 'Type': 'Clone' } );
        write(200, res, null, json);
    }

    git.repository.getRepositories(workspaceDir, function(err, repos) {
        if (err)
        {
            write(500, res, 'Cannot get repostory list');
        }
        else
        {
            
            if (rest.split(path.sep)[1] === 'file') //info about one repo
            {

                var entry;
                repos.forEach(function (repo) {
                    if (repo === rest.split(path.sep)[2])
                    {
                        entry = repo;
                    }
                });
                sendResponse([entry]);
            }
            else //all repos
            {
                sendResponse(repos);
            }
        }
    });
}

function getCommit(res, rest, dataJson, workspaceDir) {
    var repoName;
    var repoPath;

    repoName= path.basename(rest);
    repo = path.join(repoName, '.git');
    repoPath= path.join(workspaceDir, repo);

     function getParents(parents)
     {
         var entries = [ ];

         parents.forEach(function (parent) {
             var entry = {
                       'Location': '/gitapi/commit/' + parent + '/file/' + repoName,
                       'Name': parent
             };
             entries.push(entry);
         });

         return entries;
     }

     function getBranches(branches)
     {
         var entries = [ ];
         //console.log(parents);{"FullName": "refs/heads/dev"},
         branches.forEach(function (branch) {
             var entry = {
                       'FullName': 'refs/heads/' + branch
             };
             entries.push(entry);
         });
         //console.log(entries);
         return entries;
     }
     
     function getDiffs(commit)
     {
         var entries = [ ];
         //console.log(parents);{"FullName": "refs/heads/dev"},
            for (var file in commit.diffs){
                var diff = commit.diffs[file];
                var OldPath;
                var diffLocation;
                var modified = true;

                if (commit.parents.length == 0)
                {
                    OldPath = '/dev/null';
                    diffLocation = '/gitapi/diff/' + commit.sha1 + '/file/' + repoName +  file;
                }
                else
                {
                    OldPath = file;
                    diffLocation = '/gitapi/diff/' + commit.parents[0] + '..' + commit.sha1 + '/file/' + repoName + file;

                }
                var changeType;
                if (diff.length === 1)
                {
                    if (diff[0].added)
                    {
                        changeType = 'ADD';
                    }
                    else if (diff[0].removed)
                    {
                        changeType = 'DELETE';
                    }
                    else
                    {
                        modified = false;
                    }
                    
                }
                else
                {
                       changeType = 'MODIFY';
                }
                var entry =  {
                                    'ChangeType': changeType,
                                    'ContentLocation': '/file/' + repo + '/' + file,
                                    'DiffLocation': diffLocation,
                                    'NewPath': file,
                                    'OldPath': OldPath,
                                    'Type': 'Diff'
                            };
                if (modified)
                {
                    entries.push(entry);
                }
            }
         return entries;
     }
     
    // callback - function(err, extended commit)
    function getCommitsDetails(repoPath, commits, i, callback)
    {
            if (i === commits.length)
            {
                callback(null, []);
            }
            else if (i < commits.length)
            {
                getCommitDetails(repoPath, commits[i], function(err, extendedCommit) {
                    if (err)
                    {
                        callback(err, null);
                    }
                    else
                    {
                        getCommitsDetails(repoPath, commits, i + 1, function(err, commits2) {
                            if (err)
                            {
                                callback(err, null);
                            }
                            else
                            {
                                callback(null, commits2.concat(extendedCommit));
                                
                            }
                        });
                    }
                });
            
            }
    }

    // callback(err, []
    function getCommitDetails(repoPath, commit, callback)
    {
        git.gitCommitCommand.getCommitBranches(repoPath, commit.sha1, function(err, branches) {
            if (err)
            {
                callback(err, null);
            }
            else
            {
                commit.branches = branches
                /*
                git.gitTagCommand.getTagNames(repoPath, function(err, tags) {
                    var selectedTags = [];
                    console.log("!!!");
                    console.log(tags);
                    tags.forEach(function(tag) {
                        if (tag.objectId === commit.sha1)
                        {
                            selectedTags.push(tag);
                        }
                    });
                    commit.tags = selectedTags;
                    console.log("tags:");
                    console.log(commit.tags);
                    //callback(null, commits[i]);
                    callback(null, commit);
                });
                */
                if (commit.parents.length === 0)
                {
                    git.gitDiffCommand.getDiffCommit(repoPath, commit.sha1, function(err, diffs) {

                        commit.diffs = diffs;
                        callback(null, commit);
                    }, null);
                }
                else
                {
                    //TODO, multiple parents
                    git.gitDiffCommand.getDiffCommitCommit(repoPath, commit.parents[0], commit.sha1, function(err, diffs) {

                        commit.diffs = diffs;
                        callback(null, commit);
                    }, null);
                }
            }
        });
    }

    function sendResponse(commits)
    {
        
        getCommitsDetails(repoPath, commits, 0, function(err, extendedCommits) {

            if (err)
            {
                
            }
            else
            {
                var entries = [ ];
                extendedCommits.forEach(function (commit) {
                    //console.log(parseInt(commit.author.timestamp));
                    var parents = getParents(commit.parents);
                    var entry =     {
                            'AuthorEmail': commit.author.authorMail,
                            'AuthorImage': 'http://www.gravatar.com/avatar/dafb7cc636f83695c09974c92cf794fc?d=mm',
                            'AuthorName': commit.author.author,
                            'Branches' : getBranches(commit.branches),
                            'CloneLocation': '/gitapi/clone/file/' + repoName,
                            'CommitterEmail': commit.committer.authorMail,
                            'CommitterName': commit.committer.author,
                            'DiffLocation': '/gitapi/diff/' + commit.sha1 + '/file/' + repoName,
                            'Diffs' : getDiffs(commit),

                            'Location': '/gitapi/commit/' + commit.sha1 + '/file/' + repoName,
                            'Message': commit.description,
                            'Name': commit.sha1,
                            'Parents': parents,
                            "Tags": [], //TODO
                            'Time': 1000*parseInt(commit.author.timestamp), // why ?
                            'Type': 'Commit'
                            };
                    entries.push(entry);
                });


                var json = JSON.stringify( {    'Children' : entries, 
                                                'CloneLocation': '/gitapi/clone/file/' + repoName,
                                                'Location': "/gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
                                                'RepositoryPath': '',
                                                'Type': 'Commit',
                                                "toRef": {
                                                        "CloneLocation": "/gitapi/clone/file/" + repoName,
                                                        "CommitLocation": "/gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
                                                        "Current": true,
                                                        "DiffLocation": "/gitapi/diff/master/file/msabat/test/",
                                                        "FullName": "refs/heads/master",
                                                        "HeadLocation": "/gitapi/commit/HEAD/file/msabat/test/",
                                                        "LocalTimeStamp": 1365600727000,
                                                        "Location": "/gitapi/branch/master/file/" + repoName,
                                                        "Name": "master",
                                                        "RemoteLocation": [],
                                                        "Type": "Branch"
                                                    }
                                            
                                            } );
                write(200, res, null, json);
                
            }
            
            
        });
        
        

    }

    //  1 : /gitapi/commit/refs%252Fheads%252Fmaster/file/test/",
    //  2 : /gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/test/",
    //  3 : /gitapi/commit/HEAD/file/test
    //  4 : /gitapi/commit/file/test/
    //  5: /gitapi/commit/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/test/file.txt?parts=body

    var restWords = rest.split("/");


    var refsPrefix = 'refs%252heads%252';

    if (restWords[1] === '_')
    {
        write(200, res, null, '');
    }
    else if (restWords[1] === 'file') //TODO ?
    {

        //getHeadCommits(repoPath, callback)
    }
    else if (restWords[1] === 'HEAD') //TODO ?
    {

        //getHeadCommits(repoPath, callback)
    }
    else if (restWords[1].substr(0, refsPrefix.length) === refsPrefix) // refs heads
    {

        
        branchName = restWords[1].substr(refsPrefix.length);
        git.gitCommitCommand.geBranchCommitsByName(path.join(workspaceDir, repo), branchName, function(err, commits) {
            if (err)
            {
                write(500, res, 'Cannot get commit list');
            }
            else
            {
                //TODO sort by timestamp
                sendResponse(commits);
            }
        });
    }
    else
    {
        var sha1 = restWords[1];
        
        if (lastReqPath.query !== "parts=body")
        {
        
            git.gitCommitCommand.getCommitMetadata(path.join(workspaceDir, repo), sha1, function(err, commit) {
                if (err)
                {
                    write(500, res, 'Cannot get commit details');
                }
                else
                {
                    sendResponse([commit]);
                }
            });
        }
        else
        {
            repoName = path.basename(path.dirname(rest));

            var file = path.basename(rest);
            repo = path.join(repoName, '.git');
            repoPath= path.join(workspaceDir, repo);
            
            git.gitCommitCommand.getFileFromCommit(repoPath, sha1, file, function(err, fileContent) {
                if (err)
                {
                    write(500, res, 'Cannot get file from commit');
                }
                else
                {

                    write(200, res, null, fileContent);
                }
            });
        }
    }
}

function getConfig(res, rest, dataJson, workspaceDir) {
// /gitapi/config/core.filemode/clone/file/re/
// /gitapi/config/clone/file/re/

    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    function sendResponse (entries)
    {
        var json = JSON.stringify( {    'Children' : entries, 
                                        'CloneLocation': '/gitapi/clone/file/' + repoName,
                                        'Location': '/gitapi/config/clone/file/' + repoName,
                                        'Type': 'Config'
                                    
                                    } );
        write(200, res, null, json);
    }


    if (rest.split('/').length === 5)
    {
        git.gitConfigCommand.getOptions (repoPath, function(err, options) {
            if (err)
            {
                
            }
            else
            {
                var entries = [];
                for (var key in options) 
                {
                    var entry = {
                        'CloneLocation': '/gitapi/clone/file/' + repoName,
                        'Key': key,
                        'Location': '/gitapi/config/' + key + '/clone/file/' + repoName,
                        'Type': 'Config',
                        'Value': options[key]
                    };
                    entries.push(entry);
                }
                sendResponse(entries);
            }
        });
    }
    else
    {
        var variableName = rest.split('/')[1];
        git.gitConfigCommand.getOption (repoPath, function(err, value) {
            if (err)
            {
                
            }
            else
            {
                var entry = {
                    'CloneLocation': '/gitapi/clone/file/' + repoName,
                    'Key': variableName,
                    'Location': '/gitapi/config/' + variableName + '/clone/file/' + repoName,
                    'Type': 'Config',
                    'Value': value
                };

                sendResponse([entry]);
            }
        });
    }
}
function getDiff(res, rest, dataJson, workspaceDir) {
    
    
    // /gitapi/diff/d7dcce969a69721d3cd7469191bf1e79f0e2dce5/file/re/,
    // /gitapi/diff/7fc8cf2731d665ffdedd1eebcc182a33a4334f99..e117d0e3fd17e1ce93b47d37ab89c404c3de9e51/file/re/2.txt?parts=diff
    // /gitapi/diff/Default/file/test/NewFile?parts=uris
    // /gitapi/diff/Default/file/test/anotherFile.txt?parts=uris
    var splittedRest = rest.split('/');
    var uris = 'parts=uris';
    var repoName = path.basename(splittedRest[3]);
    var repo = path.join(repoName, '.git');
    var repoPath = path.join(workspaceDir, repo);
    var file = splittedRest[4];

    
    if (splittedRest[1] === 'Default') //TODO: test when status is done
    {
        // Getting a diff between working tree and index 
        if (lastReqPath.query === uris)
        {
                /*
    Base: "/gitapi/index/file/msabat/test/anotherFile.txt"
    CloneLocation: "/gitapi/clone/file/msabat/test/"
    Location: "/gitapi/diff/Default/file/msabat/test/anotherFile.txt"
    New: "/file/msabat/test/anotherFile.txt"
    Old: "/gitapi/index/file/msabat/test/anotherFile.txt"
    Type: "Diff"
                */
                var json = JSON.stringify( {    
                                                'Base': '/gitapi/index/file/' + repoName + '/' + file,
                                                'CloneLocation': '/gitapi/clone/file/' + repoName,
                                                'Location': '/gitapi/diff/Default/file' + repoName + '/' + file,
                                                'New': '/file/' + repoName + '/' + file,
                                                'Old': '/gitapi/index/file/' + repoName + '/' + file,
                                                'Type': 'Diff'
                                            } );
                write(200, res, null, json);
        }
        else if (lastReqPath.query === 'parts=diff')
        {
            git.gitDiffCommand.getDiffWorkingTreeAndIndex(repoPath, function(err, diffs) {
                if (err)
                {
                    write(500, res, 'Cannot get diff');
                }
                else
                {
                    var temp = git.gitDiffCommand.diffToString(file,file,diffs[file]);
                    write(200, res, null, temp);
                }
            }, file);
        }
    }
    else if (splittedRest[1].length === 40) // 
    {
        
        var sha1 = splittedRest[1];
        if (lastReqPath.query === uris)
        {
                var json = JSON.stringify( {    
                                                'Base': '/gitapi/commit/' + sha1 + '/file/' + repoName + '/' + file + 'parts=body',
                                                'CloneLocation': '/gitapi/clone/file/' + repoName,
                                                'Location': '/gitapi/diff/' + sha1 + '/file/' + repoName + '/' + file,
                                                'New': '/gitapi/commit/' + sha1 + '/file/' + repoName + '/' + file + '?parts=body',
                                                'Old': '/gitapi/commit/_/file/' + repoName + '/' + file + '?parts=body',
                                                'Type': 'Diff'
                                            } );
                write(200, res, null, json);
        }
        else if (lastReqPath.query === 'parts=diff')
        {
            if (splittedRest[splittedRest.length-1] === '')
            {
                write(200, res, null, 'test'); //TODO
            }
            else
            {
                    git.gitDiffCommand.getDiffCommit(repoPath, sha1, function(err, diffs) {
                        if (err)
                        {
                            write(500, res, 'Cannot get diff');
                        }
                        else
                        {
                            var temp = git.gitDiffCommand.diffToString(file,file,diffs[file]);
                            write(200, res, null, temp);
                        }
                    }, file);
            }
        }

    }
    else
    {
        var sha1 = splittedRest[1].split('..');
        var newSha1 = sha1[1];
        var oldSha1 = sha1[0];
        if (lastReqPath.query === uris)
        {
                var json = JSON.stringify( {    
                                                'Base': '/gitapi/commit/' + oldSha1 + '/file/' + repoName + '/' + file + 'parts=body', //TODO or newSha1 ?
                                                'CloneLocation': '/gitapi/clone/file/' + repoName,
                                                'Location': '/gitapi/diff/' + oldSha1 + '..' + newSha1 + '/file/' + repoName + '/' + file,
                                                'New': '/gitapi/commit/' + newSha1 + '/file/' + repoName + '/' + file + '?parts=body',
                                                'Old': '/gitapi/commit/' + oldSha1 + '/file/' + repoName + '/' + file + '?parts=body',
                                                'Type': 'Diff'
                                            } );
                write(200, res, null, json);
        }
        else
        {
            git.gitDiffCommand.getDiffCommitCommit(repoPath, oldSha1, newSha1, function(err, diffs) {
                if (err)
                {
                    write(500, res, 'Cannot get diff');
                    
                }
                else
                {
                    var temp = git.gitDiffCommand.diffToString(file,file,diffs[file]);
                    write(200, res, null, temp);
                }
            }, file);
        }

    }

}

function getIndex(res, rest, dataJson, workspaceDir) {
	
}


function getRemote(res, rest, dataJson, workspaceDir) {
    var repoName = rest.split('/');
    repoName = repoName[repoName.length - 2];
    var pathToRepo = workspaceDir + '/' + repoName + '/.git';
    var restPathSize = rest.split("/").length;
    var dataToResponse;

    if (restPathSize == 4) {
        git.gitRemoteCommand.getRemotesNames(pathToRepo, function(err, remotesNames) {
            if (err) {
                write(500, res, err);
                return;
            }
            var remotesNamesToResponse = new Array();
            for (var name in remotesNames) {
                remotesNamesToResponse.push(
                    {
                        "Location": "/gitapi/remote/" + name + "/file/" + repoName + "/",
                        "Name": repoName
                    }
                );
            }

            dataToResponse = {
                "Children": remotesNamesToResponse
            }
            write(200, res, null, JSON.stringify(dataToResponse));
            return;
        });
    } else if (restPathSize == 5) {
        
    } else {
        
    }
}


//TODO not finished
function getStatus(res, rest, dataJson, workspaceDir) {
            write(500, res, 'Cannot get repostory status');

/*
Added: []
Changed: []
CloneLocation: "/gitapi/clone/file/msabat/test2/"
CommitLocation: "/gitapi/commit/HEAD/file/msabat/test2/"
Conflicting: []
IndexLocation: "/gitapi/index/file/msabat/test2/"
Location: "/gitapi/status/file/msabat/test2/"
Missing: []
Modified: []
Removed: []
RepositoryState: "SAFE"
Type: "Status"
Untracked: []

{
 "Added": [],
 "Changed": [],
 "CommitLocation": "http://localhost:8080/git/commit/HEAD/file/E/",
 "Conflicting": [],
 "IndexLocation": "http://localhost:8080/git/index/file/E/",
 "Missing": [],
 "Modified": [{
   "Git": {
     "CommitLocation": "http://localhost:8080/git/commit/HEAD/file/E/a.txt",
     "DiffLocation": "http://localhost:8080/git/diff/Default/file/E/a.txt",
     "IndexLocation": "http://localhost:8080/git/index/file/E/a.txt"
   },
   "Location": "http://localhost:8080/file/E/a.txt",
   "Name": "a.txt",
   "Path": "a.txt"
 }],
 "Removed": [],
 "Untracked": []
 }
*/
}

function getTag(res, rest, dataJson, workspaceDir) {
    var repoName = rest.split('/');
    repoName = repoName[repoName.length - 2];
    var pathToRepo = workspaceDir + '/' + repoName + '/.git';

    git.gitTagCommand.getTagNames(pathToRepo, function(err, tags) {
        if (err) {
            writeError(500, res, err);
            return;
        }
        var dataToResponse;
        var tagsToResponse = new Array();
        for (var tagIndex in tags) {
            tagsToResponse.push(
                {
                    "FullName": "refs/tags/" + tags[tagIndex],
                    "Name": tags[tagIndex]
                }
            );
        }
        dataToResponse = {
            "Children": tagsToResponse
        }

        write(200, res, null, JSON.stringify(dataToResponse));
        return;
    });
}


function postBranch(res, rest, dataJson, workspaceDir) {
    var repoName = rest.split('/');
    repoName = repoName[repoName.length - 2];
    var pathToRepo = workspaceDir + '/' + repoName + '/.git';
    var branchName = dataJson.Name;
    git.gitBranchCommand.createBranch(pathToRepo, branchName, function(err) {
        if (err) {
            writeError(500, res, err);
            return;
        }
        var dataToResponse = {
            "CloneLocation": "/gitapi/clone/file/" + repoName + "/",
            "CommitLocation": "/gitapi/commit/" + branchName + "/file/" + repoName + "/",
            "Current": false,
            "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
            "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
            "Name": branchName,
            "RemoteLocation": "/gitapi/remote/origin/" + branchName + "/file/" + repoName +  "/",
            "Type": "Branch"
        }
        write(201, res, null, JSON.stringify(dataToResponse));
        return;
    });
}

// TODO mk dir orionode/.workspace !!!
function postClone(res, rest, dataJson, workspaceDir) {
    //TODO req: {"Name":"repo","Location":"/workspace/orionode"} - workspace or .workspace ?
    var dir = ph.join(workspaceDir, dataJson['Name']);

    fs.mkdir(dir, function (err) {
        if (err)
        {
            console.log(err);
            writeError(500, res, 'Error occured. Cannot create ' + dataJson['Name'] + ' dir');
        }
        else {
            git.gitInitCommand.init (dir, function(err) {
                if (err)
                {
                    console.log(err);
                    writeError(500, res, 'Error occured. Cannot create .git dir');
                }
                else {
                    var resJson = JSON.stringify({ 'Location' :  '/gitapi/clone/file/' + dataJson['Name'] });
                    write(201, res, null, resJson)
                }
            })
        }
    });
	
    
}

function postCommit(res, rest, dataJson, workspaceDir) {

}

function postConfig(res, rest, dataJson, workspaceDir) {


    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');

    git.gitConfigCommand.addOption (repoPath, dataJson['Key'], dataJson['Value'], function(err) {
        if (err)
        {
            
        }
        else
        {
            var json = JSON.stringify( {
                        'CloneLocation': '/gitapi/clone/file/' + repoName,
                        'Key': dataJson['key'],
                        'Location': '/gitapi/config/' + dataJson['key'] + '/clone/file/' + repoName,
                        'Type': 'Config',
                        'Value': dataJson['value']
                    } );
        write(200, res, null, json);
        }
        
    });

}
function postDiff(res, rest, dataJson, workspaceDir) {
	
}

function postIndex(res, rest, dataJson, workspaceDir) {
	
}

function postRemote(res, rest, dataJson, workspaceDir) {
	
}

function postStatus(res, rest, dataJson, workspaceDir) {
	
}

function postTag(res, rest, dataJson, workspaceDir) {
	
}

function putBranch(res, rest, dataJson, workspaceDir) {
	
}

function putClone(res, rest, dataJson, workspaceDir) {
	
}

function putCommit(res, rest, dataJson, workspaceDir) {
	
}

function putConfig(res, rest, dataJson, workspaceDir) {
// /gitapi/config/core.filemode/clone/file/test/

    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var key = rest.split('/')[1];
    git.gitConfigCommand.updateOption (repoPath, key, dataJson['Value'], function(err) {
        if (err)
        {
            
        }
        else
        {
            var json = JSON.stringify( {
                        'CloneLocation': '/gitapi/clone/file/' + repoName,
                        'Key': key,
                        'Location': '/gitapi/config/' + key + '/clone/file/' + repoName,
                        'Type': 'Config',
                        'Value': dataJson['value']
                    } );
            write(200, res, null, json);
        }
        
    });
}
function putDiff(res, rest, dataJson, workspaceDir) {
	
}

function putIndex(res, rest, dataJson, workspaceDir) {
	
}

function putRemote(res, rest, dataJson, workspaceDir) {
	
}

function putStatus(res, rest, dataJson, workspaceDir) {
	
}

function putTag(res, rest, dataJson, workspaceDir) {
	
}

function deleteBranch(res, rest, dataJson, workspaceDir) {
	
}

function deleteClone(res, rest, dataJson, workspaceDir) {
    //TODO reponame with space (%20
    var splittedRest = rest.split('/');
    var repo = splittedRest[splittedRest.length - 2];
    var path = ph.join(workspaceDir, repo);

    git.repository.removeRepository(path, function(err) {
        if (err)
        {
            writeError(500, res, 'Cannot remove repository');
        }
        else
        {
            write(200, res, null, null);
        }
    });
}

function deleteCommit(res, rest, dataJson, workspaceDir) {
	
}

function deleteConfig(res, rest, dataJson, workspaceDir) {
    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var key = rest.split('/')[1];

    git.gitConfigCommand.removeOption (repoPath, key, function(err) {
        if (err)
        {
            
        }
        else
        {
            write(200, res, null, '');
        }
        
    });

}
function deleteDiff(res, rest, dataJson, workspaceDir) {
	
}

function deleteIndex(res, rest, dataJson, workspaceDir) {
	
}

function deleteRemote(res, rest, dataJson, workspaceDir) {
	
}

function deleteStatus(res, rest, dataJson, workspaceDir) {
	
}

function deleteTag(res, rest, dataJson, workspaceDir) {
	
}
