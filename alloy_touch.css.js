/* AlloyTouch CSS v0.2.1
 * By AlloyTeam http://www.alloyteam.com/
 * Github: https://github.com/AlloyTeam/AlloyTouch
 * MIT Licensed.
 */
; (function () {
    'use strict';

    if (!Date.now)
        Date.now = function () { return new Date().getTime(); };

    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
        var vp = vendors[i];
        window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = (window[vp + 'CancelAnimationFrame']
                                   || window[vp + 'CancelRequestAnimationFrame']);
    }
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) // iOS6 is buggy
        || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
        var lastTime = 0;
        window.requestAnimationFrame = function (callback) {
            var now = Date.now();
            var nextTime = Math.max(lastTime + 16, now);
            return setTimeout(function () { callback(lastTime = nextTime); },
                              nextTime - now);
        };
        window.cancelAnimationFrame = clearTimeout;
    }
}());

; (function () {

    var _elementStyle = document.createElement('div').style,
        endTransitionEventName,
        transitionDuration,
        transitionTimingFunction,
        transform;

    if ('transform' in _elementStyle) {
        transform = 'transform';
        endTransitionEventName = 'transitionend';    // transitionend 事件在 CSS 完成过渡后触发。
        transitionDuration = 'transitionDuration';    // 完成过渡效果需要花费的时间, css transition-duration
        transitionTimingFunction = 'transitionTimingFunction';    // 以相同的速度从开始到结束的过渡效果, css transition-timing-function
    } else if ('webkitTransform' in _elementStyle) {
        transform = 'webkitTransform';
        endTransitionEventName = 'webkitTransitionEnd';    // Safari 3.1 到 6.0 
        transitionDuration = 'webkitTransitionDuration';
        transitionTimingFunction = 'webkitTransitionTimingFunction';
    } else {
        throw 'please use a modern browser'
    }

    var ease = 'cubic-bezier(0.1, 0.57, 0.1, 1)';    // 三次贝塞尔

    function reverseEase(y) {    // 相反的三次贝塞尔
        return 1 - Math.sqrt(1 - y * y);
    }

    function bind(element, type, callback) {    // 给元素添加事件
        element.addEventListener(type, callback, false);
    }

    function unbind(element, type, callback) {    // 给元素卸载事件
        element.removeEventListener(type, callback);
    }

    function preventDefaultTest(el, exceptions) {
        for (var i in exceptions) {
            if (exceptions[i].test(el[i])) {
                return true;
            }
        }
        return false;
    }

    var AlloyTouch = function (option) {
        this.scroller = option.target;    // 运动的对象
        this.element = typeof option.touch === "string" ? document.querySelector(option.touch) : option.touch;    // 反馈触摸的dom
        this.vertical = this._getValue(option.vertical,true);    // 不必需，默认是true代表监听竖直方向touch
        this.property = option.property;    // 被运动的属性
        this.preventDefault = this._getValue(option.preventDefault, true);    // 默认是true,是否阻止默认事件
        this.sensitivity =  this._getValue(option.sensitivity, 1);    // 默认是1, 灵敏度
        this.lockDirection = this._getValue(option.lockDirection, true);    // 锁定方向

        this.initialVaule = this._getValue(option.initialVaule, this.scroller[this.property]);    //被运动的属性的初始值,默认从Transform原始属性拿值
        this.scroller[this.property] = this.initialVaule;    // 给运动的属性赋值

        this.moveFactor = this._getValue(option.moveFactor, 1);    // 运动系数
        this.factor = this._getValue(option.factor, 1);    // 系数
        this.outFactor =  this._getValue(option.outFactor, 0.3);    // 外部系数

        this.min = option.min;    // 不必需,滚动属性的最小值,越界会回弹
        this.max = option.max;    // 不必需,运动属性的最大值,越界会回弹, 一般为0

        this.maxRegion = this._getValue(option.maxRegion,60);    // 最大区域, 默认60

        this.deceleration = 0.0006;    // 减速系数
        this.maxRegion = this._getValue(option.maxRegion, 600);    // 重复计算了上一个
        this.springMaxRegion = this._getValue(option.springMaxRegion, 60);    // 弹动的最大值区域, 默认60

        this.change = option.change || function () { };    // 几个回掉函数
        this.touchStart = option.touchStart || function () { };
        this.touchMove = option.touchMove || function () { };
        this.touchEnd = option.touchEnd || function () { };
        this.touchCancel = option.touchMove || function () { };
        this.animationEnd = option.animationEnd || function () { };

        this.preventDefaultException = {tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/};    // 这几个tag标签,阻止默认事件例外
        this.hasMin = !(this.min === undefined);    // 是否有min,和max属性
        this.hasMax = !(this.max === undefined);
        this.isTouchStart = false;    // 触摸是否开始
        this.step = option.step;    // 步数(写轮播用的,一般屏幕的宽度)
        this.inertia = this._getValue(option.inertia,true);    // 默认true,开启惯性效果
        this.maxSpeed = option.maxSpeed;    // 最大速度
        this.hasMaxSpeed = !(this.maxSpeed === undefined);    //是否有最大速度属性

        if (this.hasMax && this.hasMin) {
            if (this.min > this.max) throw "min value can't be greater than max value";    // 最小值不能比最大值大啊
            this.currentPage = Math.round((this.max - this.scroller[this.property]) / this.step);    // 当前第几页,比如轮播图的第几个,从0开始
        }

        this._startHandler = this._start.bind(this);    // 绑定当前this实例并赋给对应的this属性
        this._moveHandler = this._move.bind(this);
        this._endHandler = this._end.bind(this);
        this._cancelHandler = this._cancel.bind(this);
        this._transitionEndHandler = this._transitionEnd.bind(this);
        bind(this.element, "touchstart", this._startHandler);    // 给反馈触摸的dom绑定touchstart事件
        bind(this.scroller, endTransitionEventName, this._transitionEndHandler);    // 给运动的对象绑定transitionend事件(在 CSS 完成过渡后触发)
        bind(window, "touchmove", this._moveHandler);    // 给window绑定这3个事件
        bind(window, "touchend", this._endHandler);
        bind(window, "touchcancel", this._cancelHandler);
        
        this._endCallbackTag = true;    //当有step设置的时候防止执行两次end
        this._endTimeout = null;    // 结束时的定时器
        this.testCount2 = 0;
    };

    AlloyTouch.prototype = {
        _getValue: function (obj, defaultValue) {    // 是否获取默认值
            return obj === undefined ? defaultValue : obj;
        },
        _transitionEnd: function () {    // 运动dom动画运动完后触发的transitionend事件
            var current = this.scroller[this.property];    // 当前运动对象属性的值
            if (current < this.min) {
                this.to(this.min, 600, ease);
                return;
            } else if (current > this.max) {
                this.to(this.max, 600, ease);
                return;
            }

            if (this.step) {
                this.correction();
                if (this._endCallbackTag) {
                    this._endTimeout = setTimeout(function () {
                        this.animationEnd.call(this, current);
                        cancelAnimationFrame(this.tickID);
                    }.bind(this), 400);
                    this._endCallbackTag = false;
                }
            } else {
                this.animationEnd.call(this, current);    // 调用用户animationEnd(prop)的回掉函数
                cancelAnimationFrame(this.tickID);    // 取消AnimationFrame
            }
        },
        _cancelAnimation: function () {
            this.scroller.style[transitionDuration] = '0ms';    // 完成过渡效果需要花费的时间为0ms
            this.scroller[this.property] = this.getComputedPosition();    //改变运动对象属性的值
        },
        getComputedPosition: function () {    // 求出来的位置作为参数传给change回调函数
            var matrix = window.getComputedStyle(this.scroller, null);    // 求出运动对象dom的内联属性对象
            matrix = matrix[transform].split(')')[0].split(', ');
            return this.vertical ? (+(matrix[13] || matrix[5])) : (+(matrix[12] || matrix[4]));
        },
        _tick: function () {
            this.change.call(this, this.getComputedPosition());
            this.tickID = requestAnimationFrame(this._tick.bind(this)); 
            console.log(this.tickID); 
        },
        _start: function (evt) {
            cancelAnimationFrame(this.tickID);
            this._tick();    // 把_tick函数添加requestAnimationFrame中,其实就是间接调用用户change回调函数(要关闭，不然停不下来)

            this._endCallbackTag = true;
            this.isTouchStart = true;    // 触摸开始后才能进入_move方法
            this._firstTouchMove = true;    // 第一次触摸移动
            this._preventMove = false;    // 不阻止移动
            this.touchStart.call(this,evt,this.scroller[this.property]);    // 执行用户touchStart(evt, 被运动属性的值)回调函数
            this._cancelAnimation();    // 取消动画,并且给被运动对象的属性赋值
            clearTimeout(this._endTimeout);    // 关闭定时器
            if (this.hasMax && this.hasMin) {    // 计算当前第几页
                this.currentPage = Math.round((this.max - this.scroller[this.property]) / this.step);
            };
            this.startTime = new Date().getTime();    // 获取开始时的时间戳
            this._startX = this.preX = evt.touches[0].pageX;    // 获取手指开始触摸的坐标
            this._startY = this.preY = evt.touches[0].pageY;
            this.start = this.vertical ? this.preY : this.preX;    // 监听touch竖直方向就取preY值
        },
        _move: function (evt) {
            if (this.isTouchStart) {    // 触摸开始了才能进入移动
                var dx = Math.abs(evt.touches[0].pageX - this._startX), 
                    dy = Math.abs(evt.touches[0].pageY - this._startY);    // 计算触摸移动和触摸开始pageX,Y的差值
                if (this._firstTouchMove && this.lockDirection) {    // 第一次触摸并且锁定方向为true
                    var dDis = dx - dy;
                    if (dDis > 0 && this.vertical) {
                        this._preventMove = true;
                    } else if (dDis < 0 && !this.vertical) {
                        this._preventMove = true;    // 阻止移动
                    }
                    this._firstTouchMove = false;    // 第一次触摸设为false
                }
                if (dx < 10 && dy < 10) return;

                if (!this._preventMove) {    // 只有不阻止移动,才能进入此方法
                    var f = this.moveFactor;
                    var d = (this.vertical ? evt.touches[0].pageY - this.preY : evt.touches[0].pageX - this.preX) * this.sensitivity;    //如果是竖直方向取y值并且乘以灵敏度系数
                    if (this.hasMax && this.scroller[this.property] > this.max && d > 0) {
                        f = this.outFactor;
                    } else if (this.hasMin && this.scroller[this.property] < this.min && d < 0) {
                        f = this.outFactor;
                    }
                    d *= f;
                    this.preX = evt.touches[0].pageX;    // 对preX,Y属性重新取值
                    this.preY = evt.touches[0].pageY;
                    this.scroller[this.property] += d;    // 对运动对象的属性赋值

                    var timestamp = new Date().getTime();    // 获取_move中的时间戳
                    if (timestamp - this.startTime > 300) {    // 和_start中的时间戳比较,并且this.start重新赋值
                        this.startTime = timestamp;
                        this.start = this.vertical ? this.preY : this.preX;
                    };
                    this.touchMove.call(this, evt, this.scroller[this.property]);    // 执行用户的touchMove(evt, translateY或者其它属性)回调函数

                }

                if (this.preventDefault && !preventDefaultTest(evt.target, this.preventDefaultException)) {
                    evt.preventDefault();
                }
            }
        },
        _end: function (evt) {    
            if (this.isTouchStart) {    // 触摸开始了后才能进入_end
                var self = this,
                    current = this.scroller[this.property];    // 当前运动对象属性的value值
                if (this.touchEnd.call(this, evt, current) === false) return;   // 用户touchEnd返回false的话,就不用执行下面了(注意requestAnimationFrame方法还没有停止)

                if (this.hasMax && current > this.max) {    // 有最大值(手指向下拉),就大于最大值，则返回到最大值
                    this.to(this.max, 600, ease);
                } else if (this.hasMin && current < this.min) {    // 有最小值(手指向上滑),如果小于最小值，则返回到最小值
                    this.to(this.min, 600, ease);
                } else if (this.inertia && !this._preventMove) {    // 惯性效果为true并且不阻止移动_preventMove为false
                    var dt = new Date().getTime() - this.startTime;    // 差值: 当前时间戳减去_move时赋值好的时间戳
                    if (dt < 300) {

                        var distance = ((this.vertical ? evt.changedTouches[0].pageY : evt.changedTouches[0].pageX) - this.start) * this.sensitivity,    //如果是竖直方向取y值并且乘以灵敏度系数(和_move中的一样)
                            speed = Math.abs(distance) / dt,    // 速度
                            speed2 = this.factor * speed;    // 速度乘以系数
                        if(this.hasMaxSpeed && speed2 > this.maxSpeed) {
                            speed2 = this.maxSpeed;    // 如果有最大速度,speed2比最大速度还要大,就让speed2等于用户规定的最大速度
                        };
                        var destination = current + (speed2 * speed2) / (2 * this.deceleration) * (distance < 0 ? -1 : 1);    // (运动属性的最终值)目的地值(当前值 + 速度2的平方/(2倍的减速系数)*(±1))

                        var tRatio = 1;    // 比例
                        if (destination < this.min) {    // 比最小值小(就是往上划啦)
                            if (destination < this.min - this.maxRegion) {    // 比最小值加上最大区域还小
                                tRatio = reverseEase((current - this.min + this.springMaxRegion) / (current - destination));    // 参数：(当前值-最小值+弹动的最大值区域)/(当前值-目的地值)
                                destination = this.min - this.springMaxRegion;    // 重新计算目的地值：最小值-弹动的最大值区域
                            } else {
                                tRatio = reverseEase((current - this.min + this.springMaxRegion * (this.min - destination) / this.maxRegion) / (current - destination));
                                destination = this.min - this.springMaxRegion * (this.min - destination) / this.maxRegion;
                            }
                        } else if (destination > this.max) {
                            if (destination > this.max + this.maxRegion) {
                                tRatio = reverseEase((this.max + this.springMaxRegion - current) / (destination - current));
                                destination = this.max + this.springMaxRegion;
                            } else {
                                tRatio = reverseEase((this.max + this.springMaxRegion * (destination - this.max) / this.maxRegion - current) / (destination - current));
                                destination = this.max + this.springMaxRegion * (destination - this.max) / this.maxRegion;
                            }
                        }
                        var duration = Math.round(speed / self.deceleration) * tRatio;    // 持续时间：四舍五入(速度/减速系数)*上面算好的比例

                        self.to(Math.round(destination), duration, ease);    // 上面一坨就是为了求动画的持续时间duration和运动属性的最终值destination
                    } else {
                        if (self.step) {
                            self.correction();
                        }
                    }
                } else {
                    if (self.step) {
                        self.correction();
                    }
                };


                if (this.preventDefault && !preventDefaultTest(evt.target, this.preventDefaultException)) {
                    evt.preventDefault();
                };
                this.isTouchStart = false;
            }
        },
        _cancel: function (evt) {
            cancelAnimationFrame(this.tickID);
            if (this.step) {
                this.correction();
            }
            this.touchCancel.call(this, evt);
        },
        to: function (value, time, u_ease) {
            var el = this.scroller,    // 运动的对象dom
                property = this.property;    // 运动对象dom的属性

            el.style[transitionDuration] =  this._getValue(time, 600) + 'ms';    // 时间默认600ms
            el.style[transitionTimingFunction] = u_ease || ease;
            el[property] = value;    // 改变dom的属性值,并且在默认600ms或者自定义time时间内完成三次贝塞尔曲线动画
        },
        correction: function () {
            var m_str = window.getComputedStyle(this.scroller)[transform];
            var value = this.vertical ? parseInt(m_str.split(',')[13]) : parseInt(m_str.split(',')[12]);
            var rpt = Math.floor(Math.abs(value / this.step));
            var dy = value % this.step;
            var result;
            if (Math.abs(dy) > this.step / 2) {
                result = (value < 0 ? -1 : 1) * (rpt + 1) * this.step;
                if (result > this.max) result = this.max;
                if (result < this.min) result = this.min;
                this.to(result, 400, ease);
            } else {
                result = (value < 0 ? -1 : 1) * rpt * this.step;
                if (result > this.max) result = this.max;
                if (result < this.min) result = this.min;
                this.to(result, 400, ease);
            }
        },
        destroy: function () {
            unbind(this.element, "touchstart", this._startHandler);
            unbind(this.scroller, endTransitionEventName, this._transitionEndHandler);
            unbind(window, "touchmove", this._moveHandler);
            unbind(window, "touchend", this._endHandler);
            unbind(window, "touchcancel", this._cancelHandler);
        }
    };

    if (typeof module !== 'undefined' && typeof exports === 'object') {
        module.exports = AlloyTouch;
    } else {
        window.AlloyTouch = AlloyTouch;
    }

})();