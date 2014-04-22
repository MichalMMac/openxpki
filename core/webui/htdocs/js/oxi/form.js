/**
defines classes for Forms
*/



"use strict";

OXI.FormView = OXI.ContentBaseView.extend({

    templateName: "form-view",
    jsClassName:'OXI.FormView',


    default_action:null,
    default_submit_label: 'send',

    action:null,
    _actionIsTriggered : false,

    fields:[],

    FieldContainerList:[],

    submit: function (event){
        js_debug('form submit!');
        return false;
    },
    
    hasRightPane:function(){
        //this.debug('hasRightPane? ');
        return this.SectionView.hasRightPane();
    },


    submitAction: function(action, do_submit,target) {
        // will be invoked whenever the user triggers
        // the browser's `submit` method or a button is clicked explicitly

        if(this._actionIsTriggered){
            js_debug('action already triggered ...return.');
            return;
        }
        this.set('_actionIsTriggered',true);

        this.debug('Form submit with action '+action + ', target '+target);
        if(!action){
            App.applicationError('Form or Button without action!');
            return;
        }
        if(!target)target='self';
        this.resetErrors();
        var i;
        var submit_ok = true;
        var formValues = {target:target};
        if(do_submit){//should the form-values be transmitted to the server?
            for(i=0;i<this.FieldContainerList.length;i++){
                var FieldView = this.FieldContainerList[i];
                //this.debug(FieldView.fieldname +': '+FieldView.getValue());

                if(!FieldView.isValid()){
                    submit_ok = false;
                    //this.debug(FieldView.fieldname +' not valid: '+FieldView.getErrorsAsString);
                }else{
                    formValues[FieldView.fieldname] = FieldView.getValue();
                }
            }
        }
        if(submit_ok){
            this.debug('submit ok');
            formValues.action = action;
            var FormView = this;
            if(action=='login'){
                var original_target = App.get('original_target');
                js_debug('original_target:'+original_target);
                if(original_target){
                    formValues.original_target= original_target;
                    App.set('original_target','');
                }
            }
            App.showLoader();
            App.callServer(formValues).success(
            function(json){
                FormView.debug('server responded');
                FormView.set('_actionIsTriggered',false);
                //js_debug(json,2);
                App.hideLoader();
                App.renderPage(json,target,FormView);

                if(json.error){
                    var field;
                    for(field in json.error){
                        var FieldView = FormView.getFieldView(field);
                        FieldView.setError(json.error[field]);
                    }
                }
            }
            );
        }else{
            this.debug('submit nok');
            this.set('_actionIsTriggered',false);
        }


    },


    init:function(){
        //this.debug('init!');
        this._super();
        this.FieldContainerList = [];
        this.fieldContainerMap = {};
        this.fields = [];
        this.default_action = null;

        this.set('_actionIsTriggered',false);

        if( !this.content.fields){
            App.applicationError('Form, init failed: no content definition!');
            return;
        }

        this._initFields();
    },

    //method overwritten from ContentBaseView
    _initButtons:function(){
        this.debug('init buttons!');
        if(!this.content.buttons){
            //default/fallback: no list with buttons is given: lets create ONE Submit-Button with Submit-Labekl and Action
            var label = (this.content.submit_label)?this.content.submit_label:this.default_submit_label;
            if(!this.action){//action must be set via create()!
                App.applicationError('Form created without action!');
                return;
            }
            //the one-and-only button is obviously the default action:
            this.default_action = this.action;
            this.addButton({ParentView:this,label:label,action:this.action,do_submit:true,is_default:true});
        }else{
            var i;
            //determine default action:
            for(i=0;i<this.content.buttons.length;i++){
                var def = this.content.buttons[i];
                if(def.do_submit && (!this.default_action || def['default'])){
                    //first submit-button (or the one specially marked as "default") found: mark it as default
                    this.default_action = def.action;
                }
            }

            for(i=0;i<this.content.buttons.length;i++){
                var def = this.content.buttons[i];
                def.ParentView = this;
                def.is_default=(def.action == this.default_action);
                this.addButton(def);
            }
        }
    },

    /*overwritten from base-class: when "page" is given, go to parent-class::_getButton
    otherwise return a FormButton
    */
    _getButton: function(button_def){
        if(button_def.page){
            return this._super(button_def);
        }
        return OXI.FormButton.create(button_def);
    },

    _initFields:function(){
        this.fields = this.content.fields;
        var i;
        var FormView = this;
        for(i=0;i<this.fields.length;i++){
            var field=this.fields[i];
            var ContainerView;
            if(field.clonable){
                //wrap FieldContainer  in ClonableContainer
                ContainerView = OXI.ClonableFieldContainer.create({fieldDef:field,FormView:FormView});
            }else{
                ContainerView = OXI.FormFieldFactory.getComponent(field.type, {fieldDef:field,FormView:FormView});
            }

            this.FieldContainerList.push(this.createChildView(ContainerView));
            var i = this.FieldContainerList.length -1;
            this.fieldContainerMap[field.name] = i;
            //js_debug('added field '+field.name+ ' to field-map with index '+i);
        }
    },

    getFieldView:function(field){
        var i =  this.fieldContainerMap[field];
        if(i=='undefined'){
            App.applicationError('getFieldView: field not registered as View '+field);
            return;
        }
        return this.FieldContainerList[i];
    }


});


OXI.ClonableFieldControler =  Ember.Controller.extend({
    actions: {
        addField: function(){
            //js_debug('addField triggered');
            this.view.addField();
        },
        removeField: function(fieldindex){
            //js_debug('removeField ' + fieldindex);
            this.view.removeField(fieldindex);
        }
    },

    _lastItem: '' //avoid trailing commas
});

OXI.ClonableFieldContainer = OXI.View.extend({


    templateName: "form-clonable",
    jsClassName:'OXI.ClonableFieldContainer',
    
    FormView:null,//set via constructor
    fieldDef:null,//set via constructor
    FieldContainerList: null,
    label:null,
    fieldname:null,
    
    hasRightPane:function(){
        //this.debug('hasRightPane? ');
        return this.FormView.hasRightPane();
    }.property(),
    
    init:function(){

        this._super();
        if(!this.fieldDef){
            App.applicationAlert('ClonableFieldContainer: no fielddef!');
        }
        this.set('label',this.fieldDef.label);
        this.set('fieldname', this.fieldDef.name);
        this.set('FieldContainerList', Ember.ArrayController.create({
            content: Ember.A([])
        }));
        var i;
        //for each given value in value-array one field
        //this.debug('given values' + typeof this.fieldDef.values);
        var values = (typeof this.fieldDef.value == 'object' && this.fieldDef.value.length>0)?this.fieldDef.value : [this.fieldDef.value];
        for(i=0;i<values.length;i++){
            this.addField(values[i]);
        }
        
        this.set('controller',OXI.ClonableFieldControler.create({view:this}));
    },

    addField: function(value){
        var fieldDef = this.fieldDef;
        fieldDef.value = value;
        var FieldView = OXI.FormFieldFactory.getComponent(this.fieldDef.type,{fieldDef:fieldDef,FormView:this.FormView});
        this.FieldContainerList.pushObject(this.createChildView(FieldView));
        this._updateIndex();
    },

    removeField: function(fieldindex){
        var FieldView = this.FieldContainerList.content[fieldindex];
        if(!FieldView){
            js_debug('no FieldView at index '+fieldindex);
            return
        }

        this.FieldContainerList.removeAt(fieldindex);
        FieldView.destroy();
        this._updateIndex();
        
    },
    
    /**
    reindexing all clone fields, set property "isLast":
    */
    _updateIndex: function(){
        var last_index = this.FieldContainerList.content.length -1;
        this.FieldContainerList.forEach(
        function(FieldView, index, enumerable){
            FieldView.set('fieldindex',index);
            var isLast = (index==last_index);
            FieldView.set('isLast',isLast);
        }
        );
    },

    isValid: function(){
        this.resetErrors();
        var isValid = true;
        this.FieldContainerList.forEach(
        function(FieldView, index, enumerable){
            if(! FieldView.isValid()){
                isValid = false;
            }
        }
        );
        return isValid;
    },

    getValue: function(){
        var values = [];
        this.FieldContainerList.forEach(
        function(FieldView, index, enumerable){
            values.push(FieldView.getValue());
        }
        );
        return values;
    },

    _lastItem: '' //avoid trailing commas
});

OXI.FormFieldContainer = OXI.View.extend({
    
    fieldDef:null,//set via constructor
    FormView:null,//set via constructor
    
    FieldView: null,
    LabelView:null,
    label:null,
    fieldname:null,
    isRequired:true,
    clonable: false,
    classNames: ['form-group'],
    classNameBindings: ['_hasError:has-error'],
    
    isValid: function(){
        this.resetErrors();
        if(this.isRequired && this.fieldindex==0){
            if(!this.getValue()){
                this.setError('Please specify a value');
                return false;
            }
        }
        return true;
    },
    
    hasRightPane:function(){
        //this.debug('hasRightPane? ');
        return this.FormView.hasRightPane();
    }.property(),
    
    getLabel:function(){
        if(typeof(this.label) =='string'){
            return this.label;
        }
        
    }.property(),

    //needed for clonalbe fields:
    fieldindex:0,
    isFirst: function(){
        return (this.fieldindex==0);
    }.property('fieldindex'),
    
    isLast: false,//wird vom ClonableFieldContainer gesetzt

    _toString:function(){
        return this._super()+' '+this.fieldname;
    },

    init:function(){
        //Ember.debug('OXI.FormFieldContainer :init '+this.fieldDef.label);
        this.isRequired = true;
        this.FieldView = null;
        this.LabelView = null;
        this._super();
        
        
        if(typeof(this.fieldDef.name) =='string'){
            this.fieldname = this.fieldDef.name;
            this.label = this.fieldDef.label;
        }else{
            this.fieldname = 'FlexField';
            this.LabelView  =  this.createChildView(
                OXI.Select.create({name:this.fieldname+'_label', options:this.fieldDef.name,prompt:''})
            );
        }
        

        if(this.fieldDef.is_optional){//required is default!
            this.isRequired = false;
        }
    },
    setFieldView:function(View){
        this.FieldView = this.createChildView( View );
    },
    destroy: function() {
        //Ember.debug('FormFieldContainer::destroy:'+this.fieldname);
        this._super()
    },
    getValue:function(){
        return this.FieldView.value;
    },

    _lastItem: '' //avoid trailing commas
});

OXI.TextFieldContainer = OXI.FormFieldContainer.extend({
    templateName: "form-textfield",
    jsClassName:'OXI.TextFieldContainer',
    init:function(){
        //Ember.debug('OXI.TextFieldContainer :init '+this.fieldDef.label);
        this._super();
        this.setFieldView(OXI.TextField.create(this.fieldDef));
    },

    _lastItem: '' //avoid trailing commas
});

OXI.HiddenFieldContainer = OXI.TextFieldContainer.extend({
    init:function(){
        this._super();
        this.hide();
    },
    
    _lastItem: '' //avoid trailing commas
});

OXI.DateFieldContainer = OXI.TextFieldContainer.extend({
    /**
    convert given field value (in UNIX epoch) to default format of datepicker: mm/dd/yyyy
    */
    init:function(){
        var D = this._getDateObjectFromTime(this.fieldDef.value);
        if(D){
            //
            this.fieldDef.value =
            ('00' + (D.getUTCMonth()+1)).slice(-2) + '/' +
            ('00' +  D.getUTCDate()).slice(-2) + '/' +
            D.getUTCFullYear()
            ;
        }else{
            this.fieldDef.value = '';
        }
        this._super();
    },
    
    
    
    /**
    re-convert the datepicker format "mm/dd/yyyy" to specified return format
    return format can be specified via field parameter "return_format"
    for valid formats see OpenXPKI::Datetime
    default is "epoch"
    
    */
    getValue:function(){
        var v = this._super();
        if(!v) return v;
        var temp = v.split('/');
        var year = parseInt(temp[2]);
        var month = parseInt(temp[0]);
        var day = parseInt(temp[1]);
        
        var return_format = (this.fieldDef.return_format)?this.fieldDef.return_format:'epoch';
        var nf = function(i){
            if(i<10) return '0'+i;
            return i;   
        }
        switch(return_format){
            case 'terse':
                return year+''+ nf(month) +''+ nf(day) +'000000';
            case 'printable':
                return year+'-'+ nf(month) +'-'+ nf(day) +' 00:00:00';
            case 'iso8601':
                return year+'-'+ nf(month) +'T'+ nf(day) +' 00:00:00';
            
            case 'epoch':
                var D = new Date(year,month-1,day);
                var ms = D.getTime();
                if(ms){
                    return parseInt(ms/1000);//seconds
                }
                return 0;
            default:
                App.applicationAlert('date field '+this.label+': no valid return format specified: '+return_format);
                return 0;
        }
        
        
    },
    
    /**
    convert the stupid textfield to an bootstrap datepicker
    for documentation see http://bootstrap-datepicker.readthedocs.org/en/latest/
    */
    didInsertElement: function(){

        this._super();
        var options = {autoclose:true};
        var DateNotBefore = this._getDateObjectFromTime(this.fieldDef.notbefore);
        if(DateNotBefore){
            options.startDate = DateNotBefore;    
        }
        var DateNotAfter = this._getDateObjectFromTime(this.fieldDef.notafter);
        if(DateNotAfter){
            options.endDate = DateNotAfter;    
        }
        this.$('input').datepicker(options);
    },
    
    /**
    returns an JS-Date-Object, if possible
    recognices the string "now"
    */
    _getDateObjectFromTime: function(time){
        if(!time)return;
        if(time == 'now'){
            return new Date();   
        }
        //sql date and iso8601:
        if(time.match(/^\d{4}-\d{2}-\d{2}/)){
            var temp = time.split('-');
            var D = new Date(parseInt(temp[0]),parseInt(temp[1])-1,parseInt(temp[2]));
            return D;
        }
        //js_debug('epoch date? '+ time);
        var time = parseInt(time);
        if (time && !isNaN(time)) {
            var D = new Date();
            D.setTime(time*1000);
            return D;
        }

    },
    
    _lastItem: '' //avoid trailing commas
});

OXI.CheckboxContainer = OXI.FormFieldContainer.extend({
    templateName: "form-checkbox",
    jsClassName:'OXI.CheckboxContainer',
    init:function(){
        //Ember.debug('OXI.CheckboxContainer :init '+this.fieldDef.label);
        this._super();
        this.setFieldView(OXI.Checkbox.create(this.fieldDef));
    },
    isValid:function(){
        return true;//checkbox shopuld be always valid
    },

    getValue:function(){
        return (this.FieldView.isChecked())?1:0;
    },

    _lastItem: '' //avoid trailing commas
});

OXI.TextAreaContainer = OXI.FormFieldContainer.extend({
    templateName: "form-textarea",
    jsClassName:'OXI.TextAreaContainer',
    init:function(){
        //Ember.debug('OXI.TextFieldContainer :init '+this.fieldDef.label);
        this._super();
        this.setFieldView(OXI.TextArea.create(this.fieldDef));
    },

    _lastItem: '' //avoid trailing commas
});



OXI.PulldownContainer = OXI.FormFieldContainer.extend({
    templateName: "form-selectfield",
    jsClassName:'OXI.PulldownContainer',

   
    
    editable:false,
    optionAjaxSource:null,
    _isComboBox:false,


    init:function(){
        //Ember.debug('OXI.PulldownContainer :init '+this.fieldDef.label);
        this.set('editable',false);
        this._super();
        if(this.fieldDef.editable){
            this.set('editable',true);
            this.set('_isComboBox',true);   
        }
        
        if(typeof this.fieldDef.options == 'string'){
            this.set('_isComboBox',true);   
            this.set('optionAjaxSource',this.fieldDef.options);
            this.fieldDef.options = [];
        }
        this.setFieldView(OXI.Select.create(this.fieldDef));
    },

    /**
    returns the selected value
    */

    getValue:function(){
        if(this._isComboBox){
            var v = this.$('select').combobox('getValue');   
            this.debug({combo: this.fieldname, combovalue: v});
            return v;
        }
        return this._getSelected();
    },

    _getSelected:function(){
        return (this.FieldView.selection)?this.FieldView.selection.value:'';
    },

    change: function () {
        //console.log(this.FieldView.name + ' changed to '+this.getValue());
    },
    
    didInsertElement: function(){

        this._super();
        if(this._isComboBox){
            js_debug(this.fieldname+' is editable');
            var comboOptions = {queryDelay: 300,editable:this.editable};
            if(this.optionAjaxSource){
                comboOptions.ajaxSource = App.serverUrl + '?action='+this.optionAjaxSource;
            }
            
            this.$('select').addClass('form-control-combo'); 
            this.$('select').combobox(comboOptions);  
            
        }
    },
    
    

    _lastItem: '' //avoid trailing commas

});


OXI.Checkbox = Ember.Checkbox.extend(
{
	label: '',
	
	init: function(){
		this._super();
	},
    isChecked:function(){
        var checkbox = this.$();
        //we ask the DOM-element itself, not its jquery wrapper
        return checkbox[0].checked;
    },
    _lastItem: '' //avoid trailing commas
}
);


OXI.Select = Ember.Select.extend(
{
    optionLabelPath: 'content.label',
    optionValuePath: 'content.value',
    classNames: ['form-control'] ,
    prompt:null,
    
    init:function(){
        //Ember.debug('OXI.Select :init ');
        this._super();
        js_debug(this.name);
        js_debug(this.options,2);
        
        var options = (typeof this.options == 'object')?this.options:[];
        
        this.content = Ember.A(options);
        if(typeof this.prompt != 'undefined' && this.prompt=='' ){
            this.prompt = ' ';//display white option
        }
    },
    _lastItem: '' //avoid trailing commas

});

OXI.TextArea = Ember.TextArea.extend(
{
    classNames: ['form-control']
}
);

OXI.TextField = Ember.TextField.extend(
{
    classNames: ['form-control'],
	autoComplete: null,//source, value, url
    toggle:function(bShow){
        this.set('isVisible', bShow);
    },
	didInsertElement: function(){
	if(this.autoComplete){
		var mySource = new Bloodhound({
			  datumTokenizer: function(d) { 
			    return Bloodhound.tokenizers.whitespace(d.value); 
			  },
			  queryTokenizer: Bloodhound.tokenizers.whitespace,
			  local: [],
			  remote: ''

			});
		if(this.autoComplete.type == 'value' || this.autoComplete.type == 'source')
			mySource.local = this.autoComplete.source;
		if(this.autoComplete.type == 'url')
			mySource.remote = this.autoComplete.source;
		
		mySource.initialize();

		$('#'+this.elementId).typeahead(null, {source: mySource.ttAdapter()});

	}
	},
    _lastItem: '' //avoid trailing commas
}
);


OXI.FormButton = OXI.PageButton.extend({

    jsClassName:'OXI.FormButton',

    classNameBindings:['btn_type'],
    attributeBindings: ['type'],
    type:function(){
        if(this.is_default){
            return 'submit';
        }else{
            return 'button';
        }
    }.property(),


    action:null,//set via constructor (from json)
    do_submit:false,//set via constructor (from json)
    is_default:false,//set via constructor


    click: function(evt) {
        js_debug("Button with action "+this.action+" was clicked");
        this.ParentView.submitAction(this.action,this.do_submit,this.target);
    },

    init:function(){
        this._super();

        if(!this.action){
            App.applicationAlert('FormButton withot action!');
            return;
        }
    },

    _lastItem: '' //avoid trailing commas
});

OXI.UploadButton = Ember.View.extend({
	jsClassName:'OXI.PageButton',
	templateName: "page-button",
	tagName: 'button',
	classNames: ['btn'],
	parent: null,
	
	click: function(){
		this.upload();
	},
	
	upload: function(){
		var certToSend = $('#' + this.parent.textArea.elementId).val();
		var dataToSend = {'action' : 'upload_cert', 'rawData' : certToSend};
		if(certToSend){
			$.post(App.serverUrl, dataToSend, function(data, status, xhr){
				alert(data.message);
			});
		}else{
			App.applicationAlert('Please chose a File to upload!');
		}
	},
	_lastItem: ''
});

OXI.Upload = Ember.TextField.extend({
	
	jsClassName:'OXI.Upload',
	classNameBindings:['btn_type'],
	classNames: ['form-control'],
	type: 'file',
	textArea: OXI.TextArea.create(),
	areaVisible: 0,
	uploadButton: null,
	maxSize: 0, //maxSize in byte!
	allowedFiles: null,
	textAreaSize: null,
	
	init: function(){
		this._super();
	},	
	
	didInsertElement: function(){
		var field = this.$();
		var self = this;
		if(this.textAreaSize){
			var area = this.textArea.$().css({"width" : this.textAreaSize[0].width, "height" : this.textAreaSize[1].height});
		}
		if(this.areaVisible == 0){
			this.textArea.$().css('display', 'none');
		}
		field.textArea = this.textArea;
		field.maxSize = this.maxSize;
		field.allowedFiles = this.allowedFiles;
		field[0].addEventListener('change', function(e){
			var tempExtension = e.target.value.split('.');
			var extension = tempExtension[tempExtension.length-1];
			if(field.allowedFiles && !field.allowedFiles.contains(extension)){
				bootbox.alert("This file extension is not allowed for upload. Allowed extensions are: "+ field.allowedFiles.toString());
				field.val('');
				$('#' + field.textArea.elementId).val('');
				return false;
			}
			var reader = new FileReader();
			reader.textArea = $('#' + field.textArea.elementId);
			if(!field.textArea.elementId){
				reader.textArea = $(document).find('textarea');
				}
			reader.maxSize = field.maxSize;
			reader.readAsDataURL(e.target.files[0]);
			reader.onload = function(e){
				var dataURL = reader.result;
				$('#data').val(dataURL);
				if(reader.maxSize && reader.maxSize >= e.total){
					reader.textArea.val(dataURL);//if maxSize is set and its valid
				}else if(!reader.maxSize){
					reader.textArea.val(dataURL);//if maxSize is not set
				}else{
					bootbox.alert('Your file is too big to upload.');
					field.val('');
					$('#' + field.textArea.elementId).val('');
				}
			};
		});
		
	},
	_lastItem: ''
});

OXI.UploadContainer = OXI.FormFieldContainer.extend({
    templateName: "upload-view",
    jsClassName:'OXI.UploadContainer',
	uploadField: '',
	textArea: null,
    init:function(){
        this._super();
		this.uploadField = OXI.Upload.create(this.fieldDef);
		this.uploadField.set('type', 'file');//naming issue in componentFactory
		this.uploadField.set('name', 'file');
		this.textArea = this.uploadField.textArea;
		this.textAreaId = this.uploadField.textArea.elementId;
		this.setFieldView(this.uploadField);
    },
    getValue: function(){
    	return $('#' + this.textAreaId).val();
    },
    isValid: function(){
		if($('#'+this.textAreaId).val() != '' && $('#'+this.textAreaId).val() != null){
			return true;
		}else{
			return false;
		}
	},
    _lastItem: '' //avoid trailing commas
});

OXI.RadioContainer = OXI.FormFieldContainer.extend({
	templateName: "radio-view",
	jsClassName: 'OXI.RadioContainer',
	options: null,
	multi: false,
	checkBoxList: null, //should never be set by constructor
	
	init:function(){
		this._super();
		this.options = this.fieldDef.options;
		if(this.fieldDef.multi){
			this.multi = this.fieldDef.multi;
			this.checkBoxList = new Array(this.options.length);
			for(var i = 0; i < this.options.length; i++){
				/*this.checkBoxList[i] = OXI.Checkbox.create();
				this.checkBoxList[i].set('value', this.options[i].value);
				this.checkBoxList[i].set('label', this.options[i].label);*/
				this.checkBoxList[i] = this.createChildView(OXI.Checkbox.create().set('value', this.options[i].value).set('label', this.options[i].label));
				//var FieldView = OXI.FormFieldFactory.getComponent('checkbox',{fieldDef:[{label : this.options[i].label} , {value: this.options[i].value}],FormView:this.FormView});
				//this.checkBoxList[i] = FieldView;
			}
		}else{
			this.checkBoxList = new Array(this.options.length);
			for(var i = 0; i < this.options.length; i++){
				this.checkBoxList[i] = this.options[i].value;
			}
		}
	},
	getValue: function(){
		if(this.multi){			
			var values = [];
			for(var i = 0; i <this.checkBoxList.length; i++){
				if (this.checkBoxList[i].isChecked()) {
					values.push(this.checkBoxList[i].value);
				}
			}
			return values;
				
			/*var values = [];
	        this.checkBoxList.forEach(
	        function(FieldView){
	            values.push(FieldView.getValue());
	        }
	        );
	        return values;*/
			}
		else{
			var checkBoxList = this.checkBoxList;
			var ret = '';
			var i = -1;
			$("input[type = 'radio']").each(function(){
				i++;
				if($(this).get(0).checked){
					ret = checkBoxList[i];
				}
			});
			return ret;
		}
	},
	isValid: function(){
		var ret = false;
		for(var i = 0; i < this.checkBoxList.length; i++){
			if(this.checkBoxList[i].isChecked()){
				ret = true;
			}
		}
		return ret;
	},
	_lastItem: ''
	
});

//main validator class
OXI.Validator = Ember.Object.extend({
	inputField: null,
	
	getInput: function(){
		return $('#'+this.inputField.elementId).val();
	},
	setInput: function(input){
		$('#'+this.inputField.elementId).val(input);
	},
	validate: function(data){
		//override in subclass
	},
	
	_lastItem: ''
});

OXI.EmailValidator = OXI.Validator.extend({
	
	validate: function(data){
		var mail = this.getInput();
		var match = mail.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}\b/);
		return match ? true : false;
	},
	
	_lastItem: ''
});

//popover helper class
OXI.Popover = Ember.Object.extend({
	popoverField: null,
	options: null,
	register: function(){
		var field = $('#'+this.popoverField.elementId);
		field.options = this.options;
		var trigger =  field.options['trigger'] ? field.options['trigger'] : 'manual';
		field.popover({
			placement: function(){
				return field.options['placement'] ? field.options['placement'] : 'top';
			},
			html: 'true',
			content: function(){
				return field.options['content'] ? field.options['content'] : '<div><p>No content defiend<p></div>';
			},
			trigger: trigger// return field.options['content'] ? field.options['content'] : 'hover' provokes an intern bug in bootstrap!
		});
	},
	show: function(){//can only be called after register was called
		$('#'+this.popoverField.elementId).popover('show');
	},
	hide: function(){//can only be called after register was called
		$('#'+this.popoverField.elementId).popover('hide');
	},
	_lastItem: ''
});

OXI.MetaEmailField = OXI.TextField.extend({
	validator: null,
	popover: null,
	didInsertElement: function(){
		this.validator = OXI.EmailValidator.create({'inputField' : this});
		var options = new Object();
		options['trigger'] = 'manual';
		options['placement'] = 'top';
		this.popover = OXI.Popover.create({'popoverField' : this, 'options' : options});
		this.popover.register();
		var field = this.$();
		field.validator = this.validator;
		field.popover = this.popover;
		field.focusout(function(){
			if(!field.validator.validate()){
				field.popover.show();
			}
		field.focusin(function(){
			field.popover.hide();
		});	
		});
	},
	_lastItem: ''
});

OXI.MetaEmailContainer = OXI.FormFieldContainer.extend({
	templateName: "meta_email-view",
	jsClassName: 'OXI.MetaEmailContainer',
	init: function(){
		this._super();
		this.setFieldView(OXI.MetaEmailField.create(this.fieldDef));
	},
	_lastItem: ''
});
