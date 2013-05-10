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
            //console.log(rest);
            //console.log(req);
            lastReqPath = req.path;
            //console.log("LAST REQ PATH");
            //console.log(lastReqPath);
            //console.log(req._parsedUrl);
            lastReqPath = req._parsedUrl;
            //throw 'ss';
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
                       "Location": "/gitapi/commit/" + parent + "/file/" + repoName,
                       "Name": parent
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
                       "FullName": "refs/heads/" + branch
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
                console.log("aaaaaaaaaaa: " + repoName);
                if (commit.parents.length == 0)
                {
                    OldPath = '/dev/null';
                    diffLocation = "/gitapi/diff/" + commit.sha1 + "/file/" + repoName +  file;
                }
                else
                {
                    // https://orionhub.org/gitapi/diff/5329cb1882c503ea7faf0c0d1650f4d9eda59532..fe37e9c598e60df58904707be8d51094b250f4a6/file/msabat/test/New%20File?parts=uris
                    OldPath = file;
                    diffLocation = "/gitapi/diff/" + commit.parents[0] + ".." + commit.sha1 + "/file/" + repoName + file;

    // "DiffLocation": "/gitapi/diff/fe37e9c598e60df58904707be8d51094b250f4a6/file/msabat/test/",
    // "DiffLocation": "/gitapi/diff/5329cb1882c503ea7faf0c0d1650f4d9eda59532..fe37e9c598e60df58904707be8d51094b250f4a6/file/msabat/test/New%20File",

// moje:
// DiffLocation: "/gitapi/diff/d7dcce969a69721d3cd7469191bf1e79f0e2dce5/file/re/"
// DiffLocation: "/gitapi/diff/7d8a8042d1b3a1e815a9e93366918864e1444c99..d7dcce969a69721d3cd7469191bf1e79f0e2dce5/file/re/2.txt"

// moje : 
// "http://localhost:8081/gitapi/diff/7fc8cf2731d665ffdedd1eebcc182a33a4334f99..e117d0e3fd17e1ce93b47d37ab89c404c3de9e51/file/re/2.txt"
// ich:
// https://orionhub.org/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724..5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/drugi?parts=uris
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
                       changeType = "MODIFY";
                }
                var entry =  {
                                    "ChangeType": changeType,
                                    "ContentLocation": "/file/" + repo + "/" + file,
                                    "DiffLocation": diffLocation,
                                    //"DiffLocation" : "http://localhost:8081/gitapi/diff/7fc8cf2731d665ffdedd1eebcc182a33a4334f99..e117d0e3fd17e1ce93b47d37ab89c404c3de9e51/file/re/2.txt",
                                    //"DiffLocation": "/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724..5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/test/drugi",
                                    "NewPath": file,
                                    "OldPath": OldPath,
                                    "Type": "Diff"
                            };
                if (modified)
                {
                    entries.push(entry);
                }
            }
         //console.log(entries);
         return entries;
     }
     
    // callback - function(err, extended commit)
    function getCommitsDetails(repoPath, commits, i, callback)
    {
            // getCommitBranches
            //var i = 0;
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

        // get diffs
        // get tags
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
                            "Tags": [],
                            /*
                             *     "Tags": [{
      "CloneLocation": "/gitapi/clone/file/msabat/test/",
      "CommitLocation": "/gitapi/commit/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/",
      "FullName": "refs/tags/taki_tam_tag",
      "LocalTimeStamp": 1365600727000,
      "Location": "/gitapi/tag/taki_tam_tag/file/msabat/test/",
      "Name": "taki_tam_tag",
      "TagType": "ANNOTATED",
      "Type": "Tag"
    }],
    */
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
//writeError(500, res, err);
    // opcja 1 : /gitapi/commit/refs%252Fheads%252Fmaster/file/msabat/test/",
    // opcja 2 : /gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/",
    // opcja 3 : /gitapi/commit/HEAD/file/msabat/test
    // opcja 4 : /gitapi/commit/file/msabat/test/
    // opcja 5: /gitapi/commit/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/New%20File?parts=body

    //TODO:
    // opcja 6 : /gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/drugi?parts=body
    var restWords = rest.split("/");


    var refsPrefix = 'refs%252heads%252';
    
    /*
         repoName= path.basename(rest);
    repo = path.join(repoName, '.git');
    
    repoPath= path.join(workspaceDir, repo);
    */
    // getCommitBranches
    if (restWords[1] === '_')
    {
        write(200, res, null, '');
    }
    else if (restWords[1] === 'file') //TODO
    {

        //getHeadCommits(repoPath, callback)
    }
    else if (restWords[1] === 'HEAD') //TODO
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
                //console.log(commits);
                //sendResponse(commits.reverse());
                //TODO sort by timestamp
                sendResponse(commits);
            }
        });
    }
    else
    {
        var sha1 = restWords[1];
        
        console.log("zzzzzzzzzzzzzzzzz");
        console.log(restWords.length);
        //if (restWords.length === 5) 
        console.log(lastReqPath.query);
        if (lastReqPath.query !== "parts=body")
        {
        
            git.gitCommitCommand.getCommitMetadata(path.join(workspaceDir, repo), sha1, function(err, commit) {
                if (err)
                {
                    write(500, res, 'Cannot get commit details');
                }
                else
                {

                    //console.log(commits);
                    sendResponse([commit]);
                }
            });
        }
        else
        {
            repoName = path.basename(path.dirname(rest));
            console.log("repoName");
            console.log(repoName);
            var file = path.basename(rest);
            repo = path.join(repoName, '.git');
            repoPath= path.join(workspaceDir, repo);
            
            console.log(file);
            console.log(repoName);
            console.log("WEZ PLIK Z COMMITA");
            git.gitCommitCommand.getFileFromCommit(repoPath, sha1, file, function(err, fileContent) {
                if (err)
                {
                    write(500, res, 'Cannot get file from commit');
                }
                else
                {

                    //console.log(commits);
                    //sendResponse([commit]);
                    console.log("file content");
                    console.log(fileContent);
                      //var temp = "diff --git a/New File b/New File\nindex 06498fb..ae10ccb 100644\n--- a/New File\n+++ b/New File\n@@ -1 +1,4 @@\n-treść\n\\ No newline at end of file\n+treść\n+coś dodane\n+\n+modyfikacja dla trzeciego commita\n\\ No newline at end of file\n";
                      var temp = "hyhy";
                write(200, res, null, fileContent);
                    //write(200, res, fileContent);
                }
            });
        }
    }
            

        
    
   
}

function getConfig(res, rest, dataJson, workspaceDir) {
	
}
function getDiff(res, rest, dataJson, workspaceDir) {
    // comm1_sha1..comm2_sha1/file/reponame/filename
    // /gitapi/diff/7fc8cf2731d665ffdedd1eebcc182a33a4334f99..e117d0e3fd17e1ce93b47d37ab89c404c3de9e51/file/re/2.txt?parts=diff
    var splittedRest = rest.split('/');
        var uris = "parts=uris";
        var repoName = path.basename(splittedRest[3]);
        var repo = path.join(repoName, '.git');
        var repoPath = path.join(workspaceDir, repo);
        var file = splittedRest[4];
    // function getDiffCommit (repoPath, newCommitSha1, callback, relativeFilePath)
    
    if (splittedRest[1].length === 40) // /gitapi/diff/fe37e9c598e60df58904707be8d51094b250f4a6/file/msabat/test/
    {
        var sha1 = splittedRest[1];
        if (lastReqPath.query === uris)
        {
            console.log("uuuuuuuuuuuuuuuuuuuuuuuuuuuris");
                var json = JSON.stringify( {    
                                                "Base": "/gitapi/commit/" + sha1 + "/file/" + repoName + "/" + file + "parts=body", //TODO or newSha1 ?
                                                'CloneLocation': '/gitapi/clone/file/' + repoName,
                                                'Location': '/gitapi/diff/' + sha1 + '/file/' + repoName + '/' + file,
                                                'New': '/gitapi/commit/' + sha1 + '/file/' + repoName + '/' + file + '?parts=body',
                                                'Old': '/gitapi/commit/_/file/' + repoName + '/' + file + '?parts=body',
                                                //'Old': '/dev/null',
                                                'Type': 'Diff'
                                            } );
                write(200, res, null, json);
        }
        else
        {


        //if uris
            git.gitDiffCommand.getDiffCommit(repoPath, sha1, function(err, diffs) {

                console.log(err);
                //callback(null, commit);
                console.log(diffs);
                var temp = git.gitDiffCommand.diffToString(file,file,diffs[file]);
                console.log(temp);
                
                //temp = "diff --git a/New File b/New File\nindex 06498fb..ae10ccb 100644\n--- a/New File\n+++ b/New File\n@@ -1 +1,4 @@\n-treść\n\\ No newline at end of file\n+treść\n+coś dodane\n+\n+modyfikacja dla trzeciego commita\n\\ No newline at end of file\n";
                
                write(200, res, null, temp);
            }, file);
        }
    }
    else
    {
/*       
{
  "Base": "/gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/drugi?parts=body",
  "CloneLocation": "/gitapi/clone/file/msabat/test/",
  "Location": "/gitapi/diff/67c56cc33d137af40605cc628785441ddc76c724..5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/drugi",
  "New": "/gitapi/commit/5329cb1882c503ea7faf0c0d1650f4d9eda59532/file/msabat/test/drugi?parts=body",
  "Old": "/gitapi/commit/67c56cc33d137af40605cc628785441ddc76c724/file/msabat/test/drugi?parts=body",
  "Type": "Diff"
}
*/  
        

        var sha1 = splittedRest[1].split('..');
        var newSha1 = sha1[1];
        var oldSha1 = sha1[0];
        if (lastReqPath.query === uris)
        {
            console.log("uuuuuuuuuuuuuuuuuuuuuuuuuuuris");
                var json = JSON.stringify( {    
                                                "Base": "/gitapi/commit/" + oldSha1 + "/file/" + repoName + "/" + file + "parts=body", //TODO or newSha1 ?
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
            console.log('diffff');

            //splittedRest[2] - "file"

            
            
            //console.log(file);
            git.gitDiffCommand.getDiffCommitCommit(repoPath, oldSha1, newSha1, function(err, diffs) {

                console.log(err);
                //callback(null, commit);
                console.log(diffs);
                var temp = git.gitDiffCommand.diffToString(file,file,diffs[file]);
                console.log(temp);
                
                //temp = "diff --git a/New File b/New File\nindex 06498fb..ae10ccb 100644\n--- a/New File\n+++ b/New File\n@@ -1 +1,4 @@\n-treść\n\\ No newline at end of file\n+treść\n+coś dodane\n+\n+modyfikacja dla trzeciego commita\n\\ No newline at end of file\n";
                
                write(200, res, null, temp);
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

function getStatus(res, rest, dataJson, workspaceDir) {
    var repoName = path.basename(decodeURIComponent(rest));
    repo = path.join(repoName, '.git');
    var repoPath = path.join(workspaceDir, repo);
    console.log('XrepopathX ' + repoPath);
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
            console.log(result);
            var helperFunction = function(arr, key) {
                for(var i = 0; i < arr.length; ++i) {
                    var val = {
                        'Git': {
                            'CommitLocation' : '/gitapi/commit/HEAD/file/' + repoName + '/' + arr[i],
                            'DiffLocation' : '/gitapi/diff/Default/file/' + repoName + '/' + arr[i],
                            'IndexLocation' : '/gitapi/index/file/' + repoName + '/' + arr[i],
                        },
                        'Location' : '/file/' + repoName + '/' + arr[i],
                        'Name' : arr[i],
                        'Path' : arr[i]
                    };
                    entry['key'].push(val);
                }
            }
            helperFunction(result.modified, 'Removed');
            helperFunction(result.added, 'Added');
            helperFunction(result.modified, 'Modified');
            helperFunction(result.changed, 'Changed');
            helperFunction(result.missing, 'Missing');
            helperFunction(result.untracked, 'Untracked');
            //helperFunction(result.conflicts', 'Conflicting');  TODO after merge cherrypick
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
