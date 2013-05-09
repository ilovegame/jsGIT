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
            console.log(rest);
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
        OPTIONS: function(req, res, next, rest) {
            //var handler = putHandlers;
            //doJob(handler, rest, req, res, workspaceDir);
            console.log('helol!');
            var handler = getHandlers;
            console.log("GET:");
            console.log(rest);
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
                        "CommitLocation": "/gitapi/commit/" + branchName + "/file/" + repoName + "/",
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
                            "CommitLocation": "/gitapi/commit/" + branchName + "/file/" + repoName + "/",
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
    console.log("ccccccccccccccccccc");
    console.log(rest);
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
                console.log(repos);
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
//writeError(500, res, err);



    var repoName = path.basename(rest);
    repo = path.join(repoName, '.git');
    
    function sendResponse(repositories)
    {
        var entries = [ ];
        /*
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
        */
        var entry =     {
                "AuthorEmail": "admin@orionhub.org",
                "AuthorImage": "http://www.gravatar.com/avatar/dafb7cc636f83695c09974c92cf794fc?d=mm",
                "AuthorName": "admin",
                "CloneLocation": "/gitapi/clone/file/msabat/test/",
                "CommitterEmail": "admin@orionhub.org",
                "CommitterName": "admin",
                "DiffLocation": "/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/",
                "Location": "/gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/",
                "Message": "Initial commit",
                "Name": "67c56cc33d137af40605cc628785441ddc76c724",
                "Parents": [],
                "Tags": [],
                "Time": 1355154361000,
                "Type": "Commit"
                };
      entries.push(entry);
/*
  "CloneLocation": "/gitapi/clone/file/msabat/test/",
  "Location": "/gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
  "RepositoryPath": "",
  "Type": "Commit",
  "toRef": {
    "CloneLocation": "/gitapi/clone/file/msabat/test/",
    "CommitLocation": "/gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
    "Current": true,
    "DiffLocation": "/gitapi/diff/master/file/msabat/test/",
    "FullName": "refs/heads/master",
    "HeadLocation": "/gitapi/commit/HEAD/file/msabat/test/",
    "LocalTimeStamp": 1365600727000,
    "Location": "/gitapi/branch/master/file/msabat/test/",
    "Name": "master",
    "RemoteLocation": [],
    "Type": "Branch"
  }
*/
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
    
    git.gitCommitCommand.geBranchCommitsByName(path.join(workspaceDir, repo), "master", function(err, commits) {
        console.log("wykonane!");
        console.log(workspaceDir);
        //commit/master/file/re
        //console.log(rest);
        
        if (err)
        {
            write(500, res, 'Cannot get commit list');
            //console.log('aaachtung');
            //console.log(err);
        }
        else
        {
            //sendResponse(repos);
            console.log(commits);
            sendResponse([]);
        }
/*
{
  "Children": [
    {
      "AuthorEmail": "das",
      "AuthorImage": "http://www.gravatar.com/avatar/2a6571da26602a67be14ea8c5ab82349?d=mm",
      "AuthorName": "das",
      "Branches": [
        {"FullName": "refs/heads/dev"},
        {"FullName": "refs/heads/master"}
      ],
      "CloneLocation": "/gitapi/clone/file/msabat/test/",
      "CommitterEmail": "dsa",
      "CommitterName": "dsa",
      "DiffLocation": "/gitapi/diff/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/",
      "Diffs": [
        {
          "ChangeType": "ADD",
          "ContentLocation": "/file/msabat/test/New%20File",
          "DiffLocation": "/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724..5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/New%20File",
          "NewPath": "New File",
          "OldPath": "/dev/null",
          "Type": "Diff"
        },
        {
          "ChangeType": "ADD",
          "ContentLocation": "/file/msabat/test/drugi",
          "DiffLocation": "/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724..5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/drugi",
          "NewPath": "drugi",
          "OldPath": "/dev/null",
          "Type": "Diff"
        }
      ],
      "Location": "/gitapi/commit/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/",
      "Message": "sfdsf",
      "Name": "5329cb1882c503ea7faf0c0d1650f4d9eda59532",
      "Parents": [{
        "Location": "/gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/",
        "Name": "67c56cc33d137af40605cc628785441ddc76c724"
      }],
      "Tags": [],
      "Time": 1365600727000,
      "Type": "Commit"
    },
    {
      "AuthorEmail": "admin@orionhub.org",
      "AuthorImage": "http://www.gravatar.com/avatar/dafb7cc636f83695c09974c92cf794fc?d=mm",
      "AuthorName": "admin",
      "CloneLocation": "/gitapi/clone/file/msabat/test/",
      "CommitterEmail": "admin@orionhub.org",
      "CommitterName": "admin",
      "DiffLocation": "/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/",
      "Location": "/gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/",
      "Message": "Initial commit",
      "Name": "67c56cc33d137af40605cc628785441ddc76c724",
      "Parents": [],
      "Tags": [],
      "Time": 1355154361000,
      "Type": "Commit"
    }
  ],
  "CloneLocation": "/gitapi/clone/file/msabat/test/",
  "Location": "/gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
  "RepositoryPath": "",
  "Type": "Commit",
  "toRef": {
    "CloneLocation": "/gitapi/clone/file/msabat/test/",
    "CommitLocation": "/gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
    "Current": true,
    "DiffLocation": "/gitapi/diff/master/file/msabat/test/",
    "FullName": "refs/heads/master",
    "HeadLocation": "/gitapi/commit/HEAD/file/msabat/test/",
    "LocalTimeStamp": 1365600727000,
    "Location": "/gitapi/branch/master/file/msabat/test/",
    "Name": "master",
    "RemoteLocation": [],
    "Type": "Branch"
  }
}
*/
        
    
    });
}

function getConfig(res, rest, dataJson, workspaceDir) {
	
}
function getDiff(res, rest, dataJson, workspaceDir) {
	
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
    //TODO reponame with space (%20
    var splittedRest = rest.split('/');
    var repo = splittedRest[splittedRest.length - 2];
    var path = ph.join(workspaceDir, repo);

    git.gitStatusCommand.gitStatus(path, function(err, result, treeInfo, graph) {
        if(err) {
            write(500, res, 'Cannot get repostory status');
        } else {
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
*/
            var entry = {
                // 'BranchLocation': '/gitapi/branch/file/' + repository + '/', 
                'Added': [],
                'Changed': [],
                'CloneLocation': "/gitapi/clone/file/msabat/test2/",
                'CommitLocation': '/gitapi/commit/HEAD/file/E/',
                'Conflicting': [],
                'IndexLocation': '/gitapi/index/file/E/',
                'Location': "/gitapi/status/file/msabat/test2/",
                'Missing': [],
                'Modified': [],
                'Removed': [],
                'RepositoryState': "SAFE",
                'Type': "Status",
                'Untracked': []
            }
            /*
                'Modified': [{
                'Git': {
                    'CommitLocation': '/gitapi/commit/HEAD/file/E/a.txt',
                    'DiffLocation': '/gitapi/diff/Default/file/E/a.txt',
                    'IndexLocation': '/gitapi/index/file/E/a.txt'
                },
                'Location': '/gitapi/file/E/a.txt',
                'Name': 'a.txt',
                'Path': 'a.txt'
                }],
                */
            console.log(result.modified);
            console.log(result.untracked);
            console.log(result.added);
            console.log(result.missing);
            console.log(result.changed);
            console.log(result.removed);
            console.log(treeInfo);
            console.log(graph);
            // var json = JSON.stringify( { 'Children' : entries, 'Type': 'Clone' } );
            var json = JSON.stringify( entry
            );
           // write(200, res, null, json);
        }
    });
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

    git.gitTagCommand.getTags(pathToRepo, function(err, tags) {
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
