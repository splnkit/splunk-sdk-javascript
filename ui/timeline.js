
// Copyright 2011 Splunk, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

(function() {
    // Import the timeline code
    if (typeof(window) === 'undefined') {
        window = this;
    }
    
    require('../external-nocheckin/jg_global.js');
    require('../external-nocheckin/splunk_time.js');
    require('../external-nocheckin/splunk_timeline.js');
    
    var Class           = require('../lib/jquery.class').Class;
    var utils           = require('../lib/utils');
    
    var root = exports || this;

    var SplunkTimeline = this.splunk.Timeline;
    root.DateTime = this.splunk.time.DateTime;
    root.SimpleTimeZone = this.splunk.time.SimpleTimeZone;
    
    root.Timeline = Class.extend({
        init: function(el) {
            this.timeline = new SplunkTimeline();
            this.timeline.setSeriesColor(0x73A550);    
            $(this.timeline.element).addClass("Timeline");
            
            this.timeline.appendTo($(el).get(0));

            // Add the external interface formatting functions
            this.timeline.externalInterface.formatNumericString = formatNumericString;
            this.timeline.externalInterface.formatNumber = formatNumber;
            this.timeline.externalInterface.formatDate = formatDate;
            this.timeline.externalInterface.formatTime = formatTime;
            this.timeline.externalInterface.formatDateTime = formatDateTime;
            this.timeline.externalInterface.formatTooltip = formatTooltip;

            // We perform the bindings so that every function works 
            // properly when it is passed as a callback.
            this.updateWithJSON = utils.bind(this, this.updateWithJSON);
            this.updateWithXML  = utils.bind(this, this.updateWithXML);
            this.updateWithData = utils.bind(this, this.updateWithData);
        },
        
        updateWithJSON: function(timelineData) {
            var data = {
              buckets: [],
              cursorTime: new root.DateTime(timelineData.cursor_time),
              eventCount: timelineData.event_count,
              earliestOffset: timelineData.earliestOffset || 0
            }
            
            if (data.cursorTime) {
              data.cursorTime = data.cursorTime.toTimeZone(new root.SimpleTimeZone(data.earliestOffset));
            }
            
            for(var i = 0; i < timelineData.buckets.length; i++) {
              var oldBucket = timelineData.buckets[i];
              var newBucket = {
                earliestTime: new root.DateTime(oldBucket.earliest_time),
                duration: oldBucket.duration,
                eventCount: oldBucket.total_count,
                eventAvailableCount: oldBucket.available_count,
                isComplete: oldBucket.is_finalized
              }

              if (isNaN(newBucket.duration)) {
                newBucket.duration = 0;
              }
              if (isNaN(newBucket.earliestOffset)) {
                newBucket.earliestOffset = 0;
              }
              if (isNaN(newBucket.latestOffset)) {
                newBucket.latestOffset = 0;
              }

              if (newBucket.earliestTime) {
                newBucket.latestTime = new root.DateTime(newBucket.earliestTime.getTime() + newBucket.duration);
              }
              
              if (newBucket.earliestTime) {
                newBucket.earliestTime = newBucket.earliestTime.toTimeZone(new root.SimpleTimeZone(oldBucket.earliest_time_offset));
              }
              if (newBucket.latestTime) {
                newBucket.latestTime = newBucket.latestTime.toTimeZone(new root.SimpleTimeZone(oldBucket.latest_time_offset));
              }
              
              data.buckets.push(newBucket);
            }
            
            this.timeline._updateTimelineData(data);
        },
        
        updateWithXML: function(xmlNode) {
            this.timeline._parseTimelineData(xmlNode);
        },
        
        updateWithData: function(data) {
            this.timeline._updateTimelineData(data);
        }
    });
    
    var formatNumericString = function(strSingular, strPlural, num) {
        var str = (Math.abs(num) == 1) ? strSingular : strPlural;
        str = str.split("%s").join(formatNumber(num));
        return str;
    }

    var formatNumber = function(num) {
        var pos = Math.abs(num);
        if ((pos > 0) && ((pos < 1e-3) || (pos >= 1e9)))
            return num.toExponential(2).replace(/e/g, "E").replace(/\+/g, "");

        var str = String(Number(num.toFixed(3)));
        var dotIndex = str.indexOf(".");
        if (dotIndex < 0)
            dotIndex = str.length;
        var str2 = str.substring(dotIndex, str.length);
        var i;
        for (i = dotIndex - 3; i > 0; i -= 3)
            str2 = "," + str.substring(i, i + 3) + str2;
        str2 = str.substring(0, i + 3) + str2;
        return str2;
    }

    var formatDate = function(time, timeZoneOffset, dateFormat) {
        var date = new root.DateTime(time);
        date = date.toTimeZone(new root.SimpleTimeZone(timeZoneOffset));

        var monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
        var monthShortNames = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
        var weekdayShortNames = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];

        switch (dateFormat)
        {
            case "EEE MMM d":
                return  weekdayShortNames[date.getWeekday()] + " " + monthShortNames[date.getMonth() - 1] + " " + date.getDay();
            case "MMMM":
                return monthNames[date.getMonth() - 1];
            case "yyyy":
                return String(date.getYear());
            default:
                return monthShortNames[date.getMonth() - 1] + " " + date.getDay() + ", " + date.getYear();
        }
    }

    var formatTime = function(time, timeZoneOffset, timeFormat) {
        var date = new root.DateTime(time);
        date = date.toTimeZone(new root.SimpleTimeZone(timeZoneOffset));

        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = Math.floor(date.getSeconds());
        var milliseconds = Math.floor((date.getSeconds() - seconds) * 1000);
        var ampm = (hours < 12) ? "AM" : "PM";

        if (hours >= 12)
            hours -= 12;
        if (hours == 0)
            hours = 12;

        hours = ("" + hours);
        minutes = (minutes < 10) ? ("0" + minutes) : ("" + minutes);
        seconds = (seconds < 10) ? ("0" + seconds) : ("" + seconds);
        milliseconds = (milliseconds < 100) ? (milliseconds < 10) ? ("00" + milliseconds) : ("0" + milliseconds) : ("" + milliseconds);

        switch (timeFormat)
        {
            case "short":
                return hours + ":" + minutes + " " + ampm;
            case "medium":
                return hours + ":" + minutes + ":" + seconds + " " + ampm;
            case "long":
            case "full":
                return hours + ":" + minutes + ":" + seconds + "." + milliseconds + " " + ampm;
            default:
                if (milliseconds != "000")
                    return hours + ":" + minutes + ":" + seconds + "." + milliseconds + " " + ampm;
                if (seconds != "00")
                    return hours + ":" + minutes + ":" + seconds + " " + ampm;
                return hours + ":" + minutes + " " + ampm;
        }
    }

    var formatDateTime = function(time, timeZoneOffset, dateFormat, timeFormat) {
        return formatDate(time, timeZoneOffset, dateFormat) + " " + formatTime(time, timeZoneOffset, timeFormat);
    }

    var formatTooltip = function(earliestTime, latestTime, earliestOffset, latestOffset, eventCount)
    {
        return formatNumericString("%s event", "%s events", eventCount) + " from " + formatDateTime(earliestTime, earliestOffset) + " to " + formatDateTime(latestTime, latestOffset);
    }
    
})();