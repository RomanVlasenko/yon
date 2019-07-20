var ruleControlDiv;
var buttonsDiv;
var additionalButtonsDiv;
var $existingRulesContainer;

$(document).ready(function () {

    $existingRulesContainer = $("#existing-rules");

    chromeAPI.runtime.sendMessage({msg: "resetUpdates"});

    var $container = $("#container");

    refreshRuleControls(function () {
        sl.readState(function (state) {
            if (state.page == NORMAL_MODE) {
                $container.show();
            } else {
                restoreEdit();
                $container.show();
            }
        });
    });

    var $ruleControls = $("#controls");
    ruleControlDiv = $ruleControls.find(".rule-control");
    buttonsDiv = $ruleControls.find(".rule-buttons");
    additionalButtonsDiv = $ruleControls.find(".rule-buttons-more");

    chromeAPI.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if (request.msg == "refreshList") {
                refreshRuleControls();
            }
        });

});

function refreshRuleControls() {
    var callback = arguments.length > 0 ? arguments[0] : c.emptyCallback;

    ruleStorage.readRules(function (rules) {
        if (rules.length > 0) {
            $existingRulesContainer.find("#norules").remove();

            var $ruleControls = $existingRulesContainer.find(".rule-control");

            var sortedRules = _.sortBy(rules, function (r) {
                return r.index;
            });

            //Create/Update elements
            _.each(sortedRules, function (rule) {
                var $ruleControl = $ruleControls.filter("[id=" + rule.id + "]");

                if ($ruleControl.length > 0) {
                    updateRuleControlDOM(rule, $ruleControl);
                } else {
                    createRuleControlDOM(rule);
                }
            });

            //Remove deleted elements
            _.each($ruleControls, function (e) {
                var ruleId = $(e).attr("id");
                var ruleExists = _.any(rules, function (r) {
                    return r.id == ruleId;
                });

                if (!ruleExists) {
                    $(e).remove();
                }
            });

            //Update rules flag NEW to 'false'
            ruleStorage.readRules(function (rules) {
                _.each(rules, function (r) {
                    r.new = false;
                    r.notified = true;
                });
                ruleStorage.saveRules(rules, function () {
                    callback();
                });
            });

            repaintStripes();

        } else {
            $existingRulesContainer.html($("#empty-rules").html());
            callback();
        }
    });
}

function createRuleControlDOM(rule) {
//    Build DOM
    var ruleControl = ruleControlDiv.clone();
    var buttons = buttonsDiv.clone();
    var $additionalButtons = additionalButtonsDiv.clone();
    $additionalButtons.attr("id", rule.id);
    $additionalButtons.find(".popup-notification input").attr("checked", rule.notify);

    var $selectedInterval = $additionalButtons.find("select.update-frequency option").filter(function() {
        return ($(this).attr("value") == rule.updateFrequency);
    });

    if ($selectedInterval.length == 0) {
        $selectedInterval = $additionalButtons.find("select.update-frequency option").first();
    }

    $selectedInterval.prop('selected', true);

    $selectedInterval.text("Update every " + $selectedInterval.text());

    showNewBadge(ruleControl, rule);

    ruleControl.attr("id", rule.id);
    ruleControl.find(".favicon").attr("src", c.getFavicon(rule.url));
    ruleControl.find(".title a").attr("title", rule.title).attr("href", rule.url).text(rule.title);
    ruleControl.find(".value span").attr("title", rule.value).text(rule.value);
    ruleControl.find(".buttons").append(buttons);

    $existingRulesContainer.append(ruleControl);

    $additionalButtons.insertAfter(ruleControl);

    //Add listeners
    buttons.on("click", ".edit", function (e) {
        onEditClick(rule.id);
        e.preventDefault();
    });

    buttons.on("click", ".settings", function (e) {
        onMoreSettingsClick($additionalButtons);
    });

    $additionalButtons.on("click", ".delete", function (e) {
        $additionalButtons.hide();
        onDeleteClick(rule.id);
        e.preventDefault();
    });

    $additionalButtons.on("click", ".clone", function (e) {
        $additionalButtons.hide();
        onCloneClick(rule.id);
        e.preventDefault();
    });

    $additionalButtons.on("click", ".clear-history", function (e) {
        onClearHistoryClick($additionalButtons, rule);
        e.preventDefault();
    });

    $additionalButtons.on("change", ".popup-notification input[type=checkbox]", function () {
        var checked = $(this).is(':checked');
        ruleStorage.readRule(rule.id, function (r) {
            r.notify = checked;
            ruleStorage.updateRule(r, c.emptyCallback);
        });
    });

    $additionalButtons.on("change", "select.update-frequency", function () {
        var selectedInterval = $(this).find(":selected").attr("value");

        ruleStorage.readRule(rule.id, function (r) {
            r.updateFrequency = parseInt(selectedInterval);
            ruleStorage.updateRule(r, c.emptyCallback);
        });
    });

    ruleControl.on("click", ".url", function (e) {
        chromeAPI.tabs.create({url: rule.url});
        e.preventDefault();
    });

    var $favicon = ruleControl.find(".favicon");
    ruleControl.find(".url").hover(function () {
        $favicon.addClass("hover");
    }, function () {
        $favicon.removeClass("hover");
    });

    function onDragStart() {
        closeAdditionalButtons();
    }

    function onDragEnd() {
        ruleStorage.readRules(function (rules) {
            $existingRulesContainer.find(".rule-control").each(function (i, e) {
                var rule = _.find(rules, function (r) {
                    return r.id == $(e).attr("id");
                });
                rule.index = i;
                rule.ver = rule.ver + 1;
            });

            ruleStorage.saveRules(rules);
        });

        repaintStripes();
    }

    ruleControl.drags({onDragStart: function () {
        onDragStart();
    }, onDragEnd: function () {
        onDragEnd();
    }});
}

function updateRuleControlDOM(rule, ruleControl) {
    showNewBadge(ruleControl, rule);
    ruleControl.find(".favicon").attr("src", c.getFavicon(rule.url));
    ruleControl.find(".title a").attr("title", rule.title).attr("href", rule.url).text(rule.title);
    ruleControl.find(".value span").text(rule.value);
    return ruleControl;
}

function onDeleteClick(ruleId) {
    ruleStorage.deleteRule(ruleId, function () {
        refreshRuleControls();
    });
}

function onCloneClick(ruleId) {
    ruleStorage.readRule(ruleId, function (rule) {
        var clonedRule = _.clone(rule);
        clonedRule.id = '';
        setRule(clonedRule);
        openRuleEditor();
    });
}

function onEditClick(ruleId) {
    ruleStorage.readRule(ruleId, function (rule) {
        setRule(rule);
        openRuleEditor();
        markRuleAsEditable(rule);
    });
}

function onMoreSettingsClick($additionalPanel) {
    $(".rule-buttons-more").each(function (i, e) {
        var buttonsMoreDiv = $(e);
        if (buttonsMoreDiv.attr("id") == $additionalPanel.attr("id")) {

            if ($additionalPanel.is(":hidden")) {

                //Show value change history
                var historyTable = $additionalPanel.find("table.history").empty();

                var ruleId = $additionalPanel.attr("id");
                ruleStorage.readRule(ruleId, function (rule) {
                    updateHistory(historyTable, rule);
                    $additionalPanel.slideDown("fast");
                });
            }

            $additionalPanel.slideUp("fast");
        } else {
            buttonsMoreDiv.slideUp("fast");
        }
    });
}

function onClearHistoryClick($additionalPanel, ruleWithHistory) {

    ruleStorage.readRule(ruleWithHistory.id, function (rule) {
        rule.history = [];

        ruleStorage.saveRule(rule, function () {
            updateHistory($additionalPanel.find("table.history"), rule)
        });
    });
}

function updateHistory($historyTable, rule) {
    $historyTable.empty();
    if (rule.history && rule.history.length > 0) {
        _.each(rule.history, function (h) {
            $historyTable.append("<tr><td><div class='history-cell' title='" + h.value + "'>" + h.value
                + "</div></td><td>"
                + "<div class='date-cell pull-right'>" + c.formatDate(new Date(h.date))
                + "</div></td></tr>");
        });
    } else {
        $historyTable.append("<p class='text-center'>" + NO_HISTORY + "</p>");
    }
}

function closeAdditionalButtons() {
    $(".rule-buttons-more").each(function (i, e) {
        $(e).hide();
    });
}

function showNewBadge($ruleControl, rule) {
    if (rule.new == true) {
        $ruleControl.find(".badge.new").fadeIn(1000);
    }
}

function repaintStripes() {
    $existingRulesContainer.find(".rule-control").removeClass("odd, even");
    $existingRulesContainer.find(".rule-control:odd").addClass("odd");
    $existingRulesContainer.find(".rule-control:even").addClass("even");
}