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
        var extendsArgs = lastReqPath.query;
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
            if (extendsArgs) {
                var branchesInfo = new Array();
                var createData = function(dict, keys, index, callback) {
                    var branchName = keys[index];
                    if (keys.length == index) {
                        callback('');
                        return;
                    }
                    git.gitCommitCommand.geBranchCommitsByName(pathToRepo, branchName, function(err, commits) {
                        if (err) {
                            writeError(500, res, err);
                            return;
                        }
                        commitsToJson(pathToRepo, repoName, commits, function(err, jsonCommit) {
                            if (err) {
                                writeError(500, res, err);
                                return;
                            }
                            branchInfo = {
                                "CloneLocation": "/gitapi/clone/file/" + repoName + "/",
                                "Commit": jsonCommit,
                                "CommitLocation": "/gitapi/commit/refs%252Fheads%252F" + branchName + "/file/" + repoName + "/",
                                "Current": branchesList[branchName]['active'],
                                "DiffLocation": "/gitapi/diff/" + branchName + "/file/" + repoName + "/",
                                "FullName": "refs/heads/" + branchName,
                                "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
                                "LocalTimeStamp": 1368125541000,
                                "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
                                "Name": branchName,
                                //"RemoteLocation": "/gitapi/remote/origin/" + branchName + "/file/" + repoName + "/",
                                "RemoteLocation": [],
                                "Type": "Branch"
                            }
                            //write(200, res, null, JSON.stringify(dataToResponse));
                            branchesInfo.push(branchInfo);
                            createData(dict, keys, index + 1, function(err) {
                                if (err) {
                                    callback(err);
                                    return;
                                }
                                callback('');
                                return;
                            });
                        });
                    });
                }
                
                var keys = new Array();
                for (var key in branchesList) {
                    keys.push(key);
                }
                createData(branchesList, keys, 0 , function(err) {

                    if (err) {
                        callback(err);
                        return;
                    }
                    dataToResponse = {
                        "Children": branchesInfo,
                        "Type": "Branch"
                    };
                    write(200, res, null, JSON.stringify(dataToResponse));
                });
            } else {
                if (selectedBranch) {
                    for (var branchName in branchesList) {
                        if (branchName != selectedBranch) {
                            continue;
                        }
                        dataToResponse = {
                            "CloneLocation": "/gitapi/clone/file/" + repoName + "/",
                            "CommitLocation": "/gitapi/commit/refs%252Fheads%252F" + branchName + "/file/" + repoName + "/",
                            "Current": branchesList[branchName]['active'],
                            "DiffLocation": "/gitapi/diff/" + branchName + "/file/" + repoName + "/",
                            "FullName": "refs/heads/" + branchName,
                            "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
                            "LocalTimeStamp": 1368155341000,
                            "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
                            "Name": branchName,
                            //"RemoteLocation": "/gitapi/remote/origin/" + branchName + "/file/" + repoName + "/",
                            "RemoteLocation": [],
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
                                "CommitLocation": "/gitapi/commit/refs%252Fheads%252F" + branchName + "/file/" + repoName + "/",
                                "Current": (branchName === 'master'), // branchesList[branchName]['active'],
                                "DiffLocation": "/gitapi/diff/" + branchName + "/file/" + repoName + "/",
                                "FullName": "refs/heads/" + branchName,
                                "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
                                "LocalTimeStamp": 1368625341000,
                                "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
                                "Name": branchName,
                                //"RemoteLocation": "/gitapi/remote/origin/" + branchName + "/file/" + repoName + "/",
                                "RemoteLocation": [],
                                "Type": "Branch"
                            }
                        );
                    }
                    var dataToResponse = {
                        "Children": branchesInfo,
                        "Type": "Branch",
                    }
                }           

                write(200, res, null, JSON.stringify(dataToResponse));
                return;
            }
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

//TODO!!!!
 //TODO sha1 should be in tags
function tagsToJson(tags, repoName) //sha1 - tagged commit sha1
{
        var entries = [ ];
        tags.forEach(function (tag) {
            var entry = {
                    'CloneLocation': '/gitapi/clone/file/' + repoName,
                    'CommitLocation': '/gitapi/commit/' + tag['commit_SHA_1'] + '/file/' + repoName,
                    'FullName' : 'refs/tags/' + tag.name,
                    "LocalTimeStamp": 1365600727000,
                    'Location': '/gitapi/tag/' + tag.name + '/file/' + repoName,
                    'Name': tag.name,
                    'TagType': 'ANNOTATED',
                    'Type': 'Tag'
            };
            entries.push(entry);
        });

        return entries;
}



/////////////////////////////////////////////////////////////////////
     function getParents(repoName, parents)
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
     
     function getDiffs(repoName, commit)
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
                                    'ContentLocation': '/file/' + repoName + '/' + file,
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
                //TODO
                
                git.gitTagCommand.getTagNames(repoPath, function(err, tags) {
                    var selectedTags = [];
                    console.log("!!!");
                    console.log(tags);
                    
                    tags.forEach(function(tag) {
                        if (tag['commit_SHA_1'] === commit.sha1)
                        {
                            selectedTags.push(tag);
                        }
                    });
                    
                    commit.tags = selectedTags;

                    //callback(null, commits[i]);
                    
                   
                    
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
                    
                    
                    
                    
                    
                    
                    
                    
                    
                    
                });
                

            }
        });
    }
    
function commitsToJson(repoPath, repoName, commits, callback)
{
        getCommitsDetails(repoPath, commits, 0, function(err, extendedCommits) {

            if (err)
            {
                callback(err, null);
            }
            else
            {
                var entries = [ ];
                extendedCommits.forEach(function (commit) {
                    //console.log(parseInt(commit.author.timestamp));
                    var parents = getParents(repoName, commit.parents);
                    var entry =     {
                            'AuthorEmail': commit.author.authorMail,
                            'AuthorImage': 'http://www.gravatar.com/avatar/dafb7cc636f83695c09974c92cf794fc?d=mm',
                            'AuthorName': commit.author.author,
                            'Branches' : getBranches(commit.branches),
                            'CloneLocation': '/gitapi/clone/file/' + repoName,
                            'CommitterEmail': commit.committer.authorMail,
                            'CommitterName': commit.committer.author,
                            'DiffLocation': '/gitapi/diff/' + commit.sha1 + '/file/' + repoName,
                            'Diffs' : getDiffs(repoName, commit),

                            'Location': '/gitapi/commit/' + commit.sha1 + '/file/' + repoName,
                            'Message': commit.description,
                            'Name': commit.sha1,
                            'Parents': parents,
                            'Tags': tagsToJson(commit.tags, repoName),
                            'Time': 1000*parseInt(commit.author.timestamp), // why ?
                            'Type': 'Commit'
                            };
                    entries.push(entry);
                });


                var json = /*JSON.stringify( */{    'Children' : entries, 
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
                                            
                                            } 
                
                callback(null, json);
            }
            
            
        });
    
}

function getCommit(res, rest, dataJson, workspaceDir) {
    var repoName;
    var repoPath;

    repoName= path.basename(rest);
    repo = path.join(repoName, '.git');
    repoPath= path.join(workspaceDir, repo);




    function sendResponse(commits)
    {
        commitsToJson(repoPath, repoName, commits, function(err, json) {
            if (err)
            {
                write(500, res, 'Cannot get repostory list');
            }
            else
            {
                write(200, res, null, JSON.stringify(json));
            }
        });

        
        

    }

    //  1 : /gitapi/commit/refs%252Fheads%252Fmaster/file/test/",
    //  2 : /gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/test/",
    //  3 : /gitapi/commit/HEAD/file/test
    //  4 : /gitapi/commit/file/test/
    //  5: /gitapi/commit/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/test/file.txt?parts=body

    var restWords = rest.split("/");


    var refsPrefix = 'refs%252Fheads%252F';

    if (restWords[1] === '_')
    {
        write(200, res, null, '');
    }
    else if (restWords[1] === 'file') //TODO not used in UI?
    {

        //getHeadCommits(repoPath, callback)
    }
    else if (restWords[1] === 'HEAD') //TODO where is it in UI?
    {
        git.gitCommitCommand.getHeadCommits(path.join(workspaceDir, repo), function(err, commits) {
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
                write(500, res, 'Error occured');
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
                write(500, res, 'Error occured');
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
    var repoName = splittedRest[3];
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
                                                'CloneLocation': '/gitapi/clone/file/' + repoName + '/',
                                                'Location': '/gitapi/diff/Default/file/' + repoName + '/' + file,
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
                    //write(200, res, null, temp);
                    write(200, res, null, ''); //TODO why does this work?!
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
    var splittedRest = rest.split('/');
// /gitapi/index/file/re/12321.txt
    var repoName = splittedRest[2];
    var file = splittedRest[3];
    var repo = path.join(repoName, '.git');
    var repoPath = path.join(workspaceDir, repo);
    console.log('---------------------');
    //file = path.join(path.dirname(repoPath), 
    file = path.join(workspaceDir, repoName, file);
        console.log(repoPath);
    console.log(file);
	git.gitAddCommand.getFileContent(file, repoPath, function(content, err) { //TODO in gitAdd args should be reversed
        if (err)
        {
            
        }
        else
        {
            console.log(err);
            console.log(content);
            write(200, res, null, content['Content']);
        }

    });
    
    
}


function getRemotes(pathToRepo, repoName, callback)
{
         git.gitRemoteCommand.getRemotes(pathToRepo, function(err, remotes) {
            if (err) {
                callback(err, null);
            }
            var remotesNamesToResponse = new Array();
            if (err)
            {
                callback(err, null);
                
            }
            else
            {
                remotes.forEach(function(remote) {
                    remotesNamesToResponse.push(
                        {
                            'CloneLocation': '/gitapi/clone/file/' + remote['name'],
                            'GitUrl': remote['url'],
                            'Location': '/gitapi/remote/' + remote['name'] + '/file/' + repoName + '/',
                            'Name': remote['name'],
                            'Type' : 'Remote'
                        }
                    );
                });
                callback(err, remotesNamesToResponse);
            }
        });   
}

function getRemote(res, rest, dataJson, workspaceDir) {
    var splittedRest = rest.split('/');
    var repoName = splittedRest[splittedRest.length - 2];
    var pathToRepo = workspaceDir + '/' + repoName + '/.git';
    var restPathSize = rest.split("/").length;
    var dataToResponse;

    if (restPathSize == 4) {
        getRemotes(pathToRepo, repoName, function(err, remotes) {
            if (err)
            {
                write(500, res, err);
            }
            else
            {
                dataToResponse = {
                    'Children': remotes
                }
                write(200, res, null, JSON.stringify(dataToResponse));
            }
        });

                

    } else if (restPathSize == 5) {
        // /gitapi/remote/remote_name/file/re/
        var remoteName = splittedRest[1];
        getRemotes(pathToRepo, repoName, function(err, remotes) {
            if (err)
            {
                write(500, res, err);
            }
            else
            {
                var i = 0;
                while (remotes[i]['Name'] !== remoteName)
                {
                    ++i;
                }
                dataToResponse = {
                    'Children': [remotes[i]]
                }
                write(200, res, null, JSON.stringify(dataToResponse));
            }
        });
    } else {
        
    }
}

function getStatus(res, rest, dataJson, workspaceDir) {
    var repoName = path.basename(decodeURIComponent(rest));
    repo = path.join(repoName, '.git');
    var repoPath = path.join(workspaceDir, repo);
    git.gitStatusCommand.gitStatus(repoPath, function(err, result, treeInfo, graph) {
        if(err) {
            console.log(err);
            write(500, res, 'Cannot get repostory status');
        } else {
            var entry = {
                // 'BranchLocation': '/gitapi/branch/file/' + repository + '/', 
                'Added': [],
                'Changed': [],
                'CloneLocation': '/gitapi/clone/file/' + repoName + '/',
                'CommitLocation': '/gitapi/commit/HEAD/file/' + repoName + '/',
                'Conflicting': [],
                'IndexLocation': '/gitapi/index/file/' + repoName + '/',
                'Location': '/gitapi/status/file/' + repoName + '/',
                'Missing': [],
                'Modified': [],
                'Removed': [],
                'RepositoryState': "SAFE",
                'Type': "Status",
                'Untracked': []
            }
            var helperFunction = function(arr, key) {
                for(var i = 0; i < arr.length; ++i) {
                    var val = {
                        'Git': {
                            'CommitLocation' : '/gitapi/commit/HEAD/file/' + repoName + '/' + arr[i],
                            // 'DiffLocation' : '/gitapi/diff/Default/file/' + repoName + '/' + arr[i],
                            'DiffLocation' : '/gitapi/diff/Default/file/' + repoName +  arr[i],
                            'IndexLocation' : '/gitapi/index/file/' + repoName + '/' + arr[i],
                        },
                        'Location' : '/file/' + repoName + '/' + arr[i],
                        'Name' : arr[i],
                        'Path' : arr[i]
                    };
                    entry[key].push(val);
                }
            }
            console.log(result.removed);
            console.log(result.added);
            console.log(result.modified);
            console.log(result.changed);
            console.log(result.missing);
            console.log(result.untracked);
            helperFunction(result.removed, 'Removed');
            helperFunction(result.added, 'Added');
            helperFunction(result.modified, 'Modified');
            helperFunction(result.changed, 'Changed');
            helperFunction(result.missing, 'Missing');
            helperFunction(result.untracked, 'Untracked');
            helperFunction(result.conflicts', 'Conflicting');
            var json = JSON.stringify( entry );
            
            write(200, res, null, json);
        }
    });
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
        
        var tagsToResponse = tagsToJson(tags, repoName);
        
        dataToResponse = {
            "Children": tagsToResponse,
            'Type' : 'Tag'
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
            "CommitLocation": "/gitapi/commit/refs%252Fheads%252F" + branchName + "/file/" + repoName + "/",
            "Current": false,
            "DiffLocation": "/gitapi/diff/" + branchName + "/file/" + repoName + "/",
            "FullName": "refs/heads/" + branchName,
            "HeadLocation": "/gitapi/commit/HEAD/file/" + repoName + "/",
            "LocalTimeStamp": 1368125321000,
            "Location": "/gitapi/branch/" + branchName + "/file/" + repoName + "/",
            "Name": branchName,
            "RemoteLocation": [],
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
    console.log('dir ' + dir);
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
                    var commitInfo = {}
                    commitInfo.description = 'Initial commit';
                    commitInfo.author = 'admin';
                    commitInfo.authorMail = 'admin';
                    commitInfo.committer = 'admin';
                    commitInfo.committerMail = 'admin';
                    git.gitCommitCommand2.emptyCommit(ph.join(dir, '.git'), commitInfo, function(err) {
                        if (err) {
                            console.log(err);
                            writeError(500, res, 'Error occured. Cannot make empty commit dir');
                            return;
                        }
                        var resJson = JSON.stringify({ 'Location' :  '/gitapi/clone/file/' + dataJson['Name'] });
                        write(201, res, null, resJson);
                    });
                }
            })
        }
    });
	
    
}

function postCommit(res, rest, dataJson, workspaceDir) {
//if error occurs 

    /*
     * WHEN CONFLICT
     * {
  "HeadUpdated": true,
  "Result": "CONFLICTING"
}
NOTHING TO DO
{
  "HeadUpdated": false,
  "Result": "OK"
}
OK SOMETHING HAS HAPPENED, NO CONFLICTS
{  
  "HeadUpdated": true,
  "Result": "OK"
}

     */
    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var getCommitJson = function(commit) {
        var parents = getParents(repoName, commit.parents);
        var entry =     {
                'AuthorEmail': commit.author.authorMail,
                'AuthorImage': 'http://www.gravatar.com/avatar/dafb7cc636f83695c09974c92cf794fc?d=mm',
                'AuthorName': commit.author.author,
                'Branches' : getBranches(commit.branches),
                'CloneLocation': '/gitapi/clone/file/' + repoName,
                'CommitterEmail': commit.committer.authorMail,
                'CommitterName': commit.committer.author,
                'DiffLocation': '/gitapi/diff/' + commit.sha1 + '/file/' + repoName,
                'Diffs' : getDiffs(repoName, commit),

                'Location': '/gitapi/commit/' + commit.sha1 + '/file/' + repoName,
                'Message': commit.description,
                'Name': commit.sha1,
                'Parents': parents,
                'Tags': tagsToJson(commit.tags, repoName),
                'Time': 1000*parseInt(commit.author.timestamp), // why ?
                'Type': 'Commit'
                };
        return JSON.stringify( entry );
    }
    
    var finishResponse = function(commit) {
        getCommitDetails(repoPath, commit, function(err, extendedCommit) {
            if (err) {
                write(500, res, 'Error occured');
                return;
            }
            var json = getCommitJson(extendedCommit);
            write(200, res, null, json);
        });
    }
    var afterCommit = function(err, commit) {
        if(err) {
            write(500, res, 'Error occured'); 
        }
        else {
            if (!commit)
                //TODO {"HttpCode":400,"DetailedMessage":"Repository contains unmerged paths","Message":"An error occured when commiting.","Severity":"Error","Code":0}
                write(400, res, 'Can\'t commit'); //ONE CANNOT COMMIT WHEN THERES ONFLICTS
            else
                finishResponse(commit);   
        }   
    }
    if('Cherry-Pick' in dataJson) {
        git.gitCommitCommand2.gitCherryPick(repoPath, dataJson['Cherry-Pick'], function(err, result) {
            if (err) {
                write(500, res, 'Error occured');
                return;
            }
            var responseJson = {};
            if(result === 'Nothing') {
                responseJson =  {
                    "HeadUpdated": false,
                    "Result": "OK"
                };
                
            } else if(result === 'OK') {
                responseJson = {  
                    "HeadUpdated": true,
                    "Result": "OK"
                }
            } else {
                responseJson = {
                    "HeadUpdated": true,
                    "Result": "CONFLICTING"
                }
            }
                
            var json = JSON.stringify(responseJson);
            console.log(json);
            console.log(res);
            write(200, res, null, json);
        });
    } else {
        var commitInfo = {}
        commitInfo.description = dataJson.Message;
        commitInfo.author = dataJson.AuthorName;
        commitInfo.authorMail = dataJson.AuthorEmail;
        commitInfo.committer = dataJson.CommitterName;
        commitInfo.committerMail = dataJson.CommitterEmail;
        if(dataJson.Amend) {
            git.gitCommitCommand2.gitCommitAmend(repoPath, commitInfo, afterCommit);   
        } else {
            git.gitCommitCommand2.gitCommitIndex(repoPath, commitInfo, afterCommit);
        }
    }
}

function postConfig(res, rest, dataJson, workspaceDir) {


    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');

    git.gitConfigCommand.addOption (repoPath, dataJson['Key'], dataJson['Value'], function(err) {
        if (err)
        {
            write(500, res, 'Error occured');
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
    var req = decodeURIComponent(rest).split('/');
    repoName = req[2];
    repo = path.join(repoName, '.git');
    var repoPath = path.join(workspaceDir, repo);
    var fileRelativeName = '';
    for(var i = 3; i < req.length; ++i) {
        fileRelativeName = path.join(fileRelativeName, req[i]);   
    }
    if (dataJson['Reset']) {

        git.gitAddCommand.removeAllFiles(repoPath, function(err) {
            if (err) {
                writeError(500, res, err);
                return;
            }
            write(200, res, null, '');
            return;
        });
    } else if (Object.prototype.toString.call(dataJson['Path']) === '[object Array]') {
        var filesPath = new Array();
        for (var pathIndex in dataJson['Path']) {
            filesPath.push(path.join(path.join(workspaceDir, repoName), dataJson['Path'][pathIndex]));
        }
        git.gitAddCommand.removeManyFiles(filesPath, repoPath, function(err) {
            if (err) {
                writeError(500, res, err);
                return;
            }
            write(200, res, null, '');
            return;
        });
    } else if (Object.prototype.toString.call(dataJson['Path']) === '[object String]') {
        git.gitAddCommand.removeOneFile(path.join(path.join(workspaceDir, repoName), dataJson['Path']), repoPath, function(err) {
            if (err) {
                writeError(500, res, err);
                return;
            }
            write(200, res, null, '');
            return;
        });
    }
}

function postRemote(res, rest, dataJson, workspaceDir) {
    var splittedRest = rest.split('/');
    var repoName = splittedRest[splittedRest.length - 2];
    var repoPath = path.join(workspaceDir, repoName, '.git');
        //{ Remote: 'aa', RemoteURI: 'vv' }
    
    git.gitRemoteCommand.addNewRemote(repoPath, dataJson['Remote'], dataJson['RemoteURI'], null, dataJson['RemoteURI'], null, function(err) {
        if (err)
        {
            console.log(err);
        }
        else
        {
                    var json = JSON.stringify( {
                        'Location': '/gitapi/remote/' + dataJson['RemoteURI'] + '/' + repoName

                    } );
            write(200, res, null, json);
        }
    });
    

}

function postStatus(res, rest, dataJson, workspaceDir) {
	
}

function postTag(res, rest, dataJson, workspaceDir) {
    //probably not used. can't find link in UI with that action
}

function putBranch(res, rest, dataJson, workspaceDir) {
	
}

function putClone(res, rest, dataJson, workspaceDir) {
    var repoName = rest.split('/');
    repoName = repoName[repoName.length - 2];
    var pathToRepo = workspaceDir + '/' + repoName + '/.git';

    git.gitCheckoutCommand.gitCheckout(dataJson['Branch'], pathToRepo, function(err) {
        if (err) {
            writeError(500, res, err);
        }
         write(200, res, null, '');
    });
	
}

function putCommit(res, rest, dataJson, workspaceDir) {
    // /gitapi/commit/d7dcce969a69721d3cd7469191bf1e79f0e2dce5/file/re/
    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var splittedRest = rest.split('/');
    var sha1 = splittedRest[1];
    var author = 'A';
    var authorMail = 'B';
    var description = 'C';
    git.gitTagCommand.addTag (repoPath, author, authorMail, dataJson['Name'], description, sha1, function(err) {
        
        write(200, res, null, '');
    });
    
}

function putConfig(res, rest, dataJson, workspaceDir) {
// /gitapi/config/core.filemode/clone/file/test/

    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var key = rest.split('/')[1];
    git.gitConfigCommand.updateOption (repoPath, key, dataJson['Value'], function(err) {
        if (err)
        {
            write(500, res, 'Error occured');
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
    //TODO multifiles;
    var req = decodeURIComponent(rest).split('/');
    repoName = req[2]; //  index/file/REPONAME/FILENAME
    repo = path.join(repoName, '.git');
    var repoPath = path.join(workspaceDir, repo);
    var fileRelativeName = '';
    for(var i = 3; i < req.length; ++i) {
        fileRelativeName = path.join(fileRelativeName, req[i]);   
    }
    git.gitAddCommand.addOneFile(path.join(path.join(workspaceDir, repoName), fileRelativeName), repoPath, function(err) {
        if (err) {
            console.log('putIndex err');
            write(500, res, 'Error occured');   
        } else {
            console.log('putIndex ok');
            write(200, res, null, '');
        }
    });
}

function putRemote(res, rest, dataJson, workspaceDir) {
	
}

function putStatus(res, rest, dataJson, workspaceDir) {
	
}

function putTag(res, rest, dataJson, workspaceDir) {
    //probably not used. can't find link in UI with that action
}

function deleteBranch(res, rest, dataJson, workspaceDir) {
// /gitapi/branch/branchName/file/re/
    var splittedRest = rest.split('/');
    var repoName = splittedRest[splittedRest.length - 2];
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var branchName = splittedRest[1];
    git.gitBranchCommand.removeBranch(repoPath, branchName, function(err) {
        if (err)
        {
            writeError(500, res, err);
        }
        else
        {
            write(200, res, null, null);
        }
    });

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
            writeError(500, res, err);
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
    var splittedRest = rest.split('/');
    var repoName = splittedRest[splittedRest.length - 2];
    var repoPath = path.join(workspaceDir, repoName, '.git');
    // /gitapi/branch/branchName/file/re/
    var branchName = splittedRest[1];
    git.gitRemoteCommand.removeRemote(repoPath, branchName, function(err) {
        if (err)
        {
            writeError(500, res, err);
        }
        else
        {
            write(200, res, null, null);
        }
    });
}

function deleteStatus(res, rest, dataJson, workspaceDir) {
	
}

function deleteTag(res, rest, dataJson, workspaceDir) {
// /gitapi/tag/tag1/file/test
    var repoName = path.basename(rest);
    var repoPath = path.join(workspaceDir, repoName, '.git');
    var tagName = rest.split('/')[1];
    git.gitTagCommand.removeTag (repoPath, tagName, function(err) {
        if (err)
        {
            write(500, res, 'Error occured');
        }
        else
        {
            write(200, res, null, '');
        }
        
    });
}
